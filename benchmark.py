import time
from unittest.mock import MagicMock

def run_benchmark(num_records):
    # Mock for unoptimized
    unoptimized_client = MagicMock()
    def fake_execute():
        time.sleep(0.01) # simulate 10ms network latency
        return MagicMock()

    unoptimized_client.table().update().eq().execute.side_effect = fake_execute
    unoptimized_client.table().insert().execute.side_effect = fake_execute

    # Run unoptimized
    start = time.time()
    logs_updated = 0
    logs_added = 0
    for i in range(num_records):
        if i % 2 == 0:
            unoptimized_client.table('call_logs').update({
                'duration_seconds': 10,
                'status': 'Answered'
            }).eq('id', i).execute()
            logs_updated += 1
        else:
            unoptimized_client.table('call_logs').insert({
                'phone_number': '12345',
            }).execute()
            logs_added += 1
    unoptimized_time = time.time() - start

    # Mock for optimized
    optimized_client = MagicMock()
    optimized_client.table().upsert().execute.side_effect = fake_execute
    optimized_client.table().insert().execute.side_effect = fake_execute

    # Run optimized
    start = time.time()
    inserts = []
    updates = []
    logs_updated = 0
    logs_added = 0
    for i in range(num_records):
        if i % 2 == 0:
            updates.append({'id': i, 'duration_seconds': 10, 'status': 'Answered'})
        else:
            inserts.append({'phone_number': '12345'})

    if updates:
        optimized_client.table('call_logs').upsert(updates).execute()
        logs_updated += len(updates)
    if inserts:
        optimized_client.table('call_logs').insert(inserts).execute()
        logs_added += len(inserts)

    optimized_time = time.time() - start

    print(f"Baseline (N={num_records}): {unoptimized_time:.4f}s")
    print(f"Optimized (N={num_records}): {optimized_time:.4f}s")
    print(f"Improvement: {unoptimized_time / optimized_time:.2f}x faster")

run_benchmark(100)
