import datetime
import random
import re
import traceback
from whatsapp_handler import _execute_whatsapp

def format_bulk_message(template, greetings, contact_name=""):
    """
    Format a bulk message by replacing {name}, {greetings}, adding random spaces,
    and italicizing a single character randomly.
    """
    # 0. Replace {name}
    message = template
    if "{name}" in message:
        name_val = contact_name.strip() if contact_name and contact_name.strip() else ""
        message = message.replace("{name}", name_val)

    # 1. Replace {greetings}
    if "{greetings}" in message:
        greeting = random.choice(greetings) if greetings else "Hello"
        message = message.replace("{greetings}", greeting)

    # 2. Add random spacing (only at beginning or after a newline)
    if random.choice([True, False]):
        message = " " + message
    
    lines = message.split('\n')
    spaced_lines = []
    for line in lines:
        if line and random.choice([True, False]):
            spaced_lines.append(" " + line)
        else:
            spaced_lines.append(line)
    message = '\n'.join(spaced_lines)

    # 3. Randomly change the first character of a word to italic using _ _
    # Match any word-starting character that follows a space, newline, or is at the beginning of the string.
    matches = list(re.finditer(r'(?:^|[\s\n])([a-zA-Z])', message))
    if matches:
        match = random.choice(matches)
        # The group(1) index is the character itself. Let's find its start position.
        idx = match.start(1)
        char = message[idx]
        message = message[:idx] + "_" + char + "_" + message[idx+1:]
 
    return message

def check_daily_limit(supabase):
    """
    Checks if the daily limit of 80 messages has been reached.
    """
    today_start = datetime.datetime.now(datetime.timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
    try:
        res = supabase.table('whatsapp_bulk_batch_contacts') \
            .select('id', count='exact') \
            .eq('status', 'sent') \
            .gte('sent_at', today_start) \
            .execute()
        return (res.count or 0) >= 80
    except Exception as e:
        print(f"⚠️ Error checking daily limit: {e}")
        return False

def get_active_batch(supabase, now_iso):
    """
    Gets the current processing batch, or starts a pending one if scheduled.
    """
    # Check for active processing batch
    res = supabase.table('whatsapp_bulk_batches').select('*').eq('status', 'processing').order('scheduled_at').limit(1).execute()
    if res.data:
        return res.data[0]

    # Look for pending batches that are due
    res = supabase.table('whatsapp_bulk_batches').select('*').eq('status', 'pending').lte('scheduled_at', now_iso).order('scheduled_at').limit(1).execute()
    if not res.data:
        return None

    # Check if broadcast test mode is enabled
    is_test_mode = False
    try:
        state_res = supabase.table('system_state').select('broadcast_test_mode').eq('id', 1).execute()
        if state_res.data and state_res.data[0].get('broadcast_test_mode'):
            is_test_mode = True
    except Exception as e:
        print(f"⚠️ Error checking system_state test mode: {e}")

    batch = res.data[0]
    if not is_test_mode:
        # Check 60-minute gap constraint between batches in the same group
        one_hour_ago = (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(minutes=60)).isoformat()
        try:
            recent = supabase.table('whatsapp_bulk_batches').select('id') \
                .eq('group_id', batch['group_id']) \
                .in_('status', ['processing', 'completed']) \
                .gte('scheduled_at', one_hour_ago) \
                .execute()
            if recent.data:
                print(f"[*] Batch '{batch['name']}' skipped: 60-minute group gap constraint in effect.")
                return None
        except Exception as e:
            print(f"⚠️ Error checking batch gap: {e}")
            return None

    # Transition pending batch to processing
    try:
        update_res = supabase.table('whatsapp_bulk_batches').update({
            'status': 'processing',
            'next_send_at': now_iso
        }).eq('id', batch['id']).execute()
        if update_res.data:
            return update_res.data[0]
    except Exception as e:
        print(f"⚠️ Error updating batch to processing: {e}")
    
    return None

def send_next_bulk_message(device, batch, run_cmd, supabase):
    """
    Sends the next contact message in the processing batch.
    """
    # Fetch greetings
    greetings = []
    try:
        g_res = supabase.table('whatsapp_greetings').select('text').execute()
        if g_res.data:
            greetings = [g['text'] for g in g_res.data]
    except Exception as e:
        print(f"⚠️ Error fetching greetings: {e}")

    # Fetch next pending contact
    contacts_res = supabase.table('whatsapp_bulk_batch_contacts') \
        .select('*') \
        .eq('batch_id', batch['id']) \
        .eq('status', 'pending') \
        .order('id') \
        .limit(1) \
        .execute()

    if not contacts_res.data:
        # All contacts completed
        print(f"[*] Batch '{batch['name']}' is completed.")
        supabase.table('whatsapp_bulk_batches').update({
            'status': 'completed',
            'next_send_at': None
        }).eq('id', batch['id']).execute()
        return

    contact = contacts_res.data[0]
    phone = contact['phone_number']
    
    # Format the randomized message text
    formatted_msg = format_bulk_message(batch['message_template'], greetings, contact.get('name', ''))
    media_file = batch.get('media_filename')

    print(f"[*] Sending bulk message to {phone} (Batch: '{batch['name']}')")
    try:
        def contact_reporter(status):
            try:
                supabase.table('whatsapp_bulk_batch_contacts').update({
                    'whatsapp_progress': status
                }).eq('id', contact['id']).execute()
            except Exception as e:
                print(f"⚠️ Error reporting bulk contact progress: {e}")

        ui_debug = batch.get('ui_debug', False)
        # Execute sharing, passing the contact reporter callback and ui_debug parameter
        _execute_whatsapp(device, phone, formatted_msg, run_cmd, media_file, supabase, contact_reporter, ui_debug=ui_debug)
        
        now = datetime.datetime.now(datetime.timezone.utc).isoformat()
        # Mark contact as sent
        supabase.table('whatsapp_bulk_batch_contacts').update({
            'status': 'sent',
            'whatsapp_progress': 'verified',
            'sent_at': now
        }).eq('id', contact['id']).execute()

        # Add to global whatsapp_logs
        supabase.table('whatsapp_logs').insert({
            'phone_number': phone,
            'contact_name': contact['name'],
            'message_text': formatted_msg,
            'file_name': media_file or None,
            'sent_at': now
        }).execute()

        # Calculate next send delay: 40s + random(0-100)s
        delay = 40 + random.randint(0, 100)
        next_send = (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(seconds=delay)).isoformat()
        
        supabase.table('whatsapp_bulk_batches').update({
            'last_sent_index': batch['last_sent_index'] + 1,
            'next_send_at': next_send
        }).eq('id', batch['id']).execute()
        
        print(f"[+] Bulk message sent. Next scheduled in {delay} seconds (at {next_send}).")
    except Exception as ex:
        print(f"⚠️ Error sending bulk message: {ex}")
        traceback.print_exc()
        # Mark contact as failed
        supabase.table('whatsapp_bulk_batch_contacts').update({
            'status': 'failed',
            'error_message': str(ex)
        }).eq('id', contact['id']).execute()
        
        # Pause the batch and stop execution right here
        supabase.table('whatsapp_bulk_batches').update({
            'status': 'paused',
            'next_send_at': None
        }).eq('id', batch['id']).execute()
        print(f"⚠️ Batch '{batch['name']}' paused due to error: {ex}")

def process_bulk_messaging(device, run_cmd, supabase):
    """
    Main bulk sending entry point. Called periodically from daemon listener.
    """
    # 1. Enforce daily limit of 80 messages
    if check_daily_limit(supabase):
        print("[*] WhatsApp bulk messaging daily limit (80 messages) reached. Holding execution.")
        return

    now_dt = datetime.datetime.now(datetime.timezone.utc)
    now_iso = now_dt.isoformat()

    # 2. Get current or next scheduled batch
    batch = get_active_batch(supabase, now_iso)
    if not batch:
        return

    # 3. Check if next send time has arrived
    next_send_at_str = batch.get('next_send_at')
    if next_send_at_str:
        next_send_dt = datetime.datetime.fromisoformat(next_send_at_str.replace('Z', '+00:00'))
        if now_dt < next_send_dt:
            return

    # 4. Process send
    send_next_bulk_message(device, batch, run_cmd, supabase)
