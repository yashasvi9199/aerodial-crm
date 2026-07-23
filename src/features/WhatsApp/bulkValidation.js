/**
 * Validates and normalizes a phone number for Indian contacts.
 * Auto-prefixes with +91 if length is 10.
 * @param {string} phone
 * @returns {string|null} Normalized phone number, or null if invalid.
 */
export function validateAndNormalizePhone(phone) {
  if (!phone) return null;
  // Strip all non-digit characters (except optional leading +)
  let clean = phone.replace(/[^\d+]/g, '');
  
  if (clean.startsWith('+')) {
    if (clean.startsWith('+91') && clean.length === 13) {
      return clean;
    }
    return null; // Invalid international code or length
  }
  
  if (clean.length === 10) {
    return '+91' + clean;
  }
  
  if (clean.length === 12 && clean.startsWith('91')) {
    return '+' + clean;
  }
  
  return null;
}

/**
 * Validates if a number is already in a list of contacts.
 * @param {string} phone
 * @param {Array<{phone_number: string}>} existingContacts
 * @returns {boolean} True if duplicate exists.
 */
export function isDuplicateContact(phone, existingContacts) {
  if (!phone) return false;
  return existingContacts.some(
    (c) => c.phone_number === phone || c.phone === phone
  );
}

/**
 * Validates if the proposed scheduled time respects the 60-minute gap constraint
 * compared to other batches in the same group.
 * @param {string|Date} proposedTime
 * @param {Array<{scheduled_at: string, status: string}>} existingBatches
 * @returns {boolean} True if the time is valid (respects the 60-minute gap).
 */
export function validateBatchSchedulingGap(proposedTime, existingBatches) {
  if (!proposedTime) return false;
  const targetTime = new Date(proposedTime).getTime();
  const ONE_HOUR_MS = 60 * 60 * 1000;

  for (const batch of existingBatches) {
    if (batch.status === 'failed') continue; // Ignored failed batches
    const batchTime = new Date(batch.scheduled_at).getTime();
    if (Math.abs(targetTime - batchTime) < ONE_HOUR_MS) {
      return false;
    }
  }
  return true;
}

/**
 * Parses a CSV string and returns validated contacts.
 * @param {string} csvText
 * @param {Array<{phone_number: string}>} existingContacts
 * @returns {{contacts: Array<{phone_number: string, name: string}>, errors: Array<string>}}
 */
export function parseAndValidateCSV(csvText, existingContacts = []) {
  const lines = csvText.split(/\r?\n/);
  const contacts = [];
  const errors = [];
  const seenInCSV = new Set();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Support comma or semicolon separation
    const parts = line.split(/[,;]/);
    let rawPhone = parts[0]?.trim();
    let rawName = parts[1]?.trim() || '';

    // If header row, skip
    if (i === 0 && (rawPhone.toLowerCase().includes('phone') || rawPhone.toLowerCase().includes('number'))) {
      continue;
    }

    const normPhone = validateAndNormalizePhone(rawPhone);
    if (!normPhone) {
      errors.push(`Row ${i + 1}: Invalid phone number format ("${rawPhone}").`);
      continue;
    }

    if (seenInCSV.has(normPhone) || isDuplicateContact(normPhone, existingContacts) || isDuplicateContact(normPhone, contacts)) {
      errors.push(`Row ${i + 1}: Duplicate number ignored ("${normPhone}").`);
      continue;
    }

    seenInCSV.add(normPhone);
    contacts.push({
      phone_number: normPhone,
      name: rawName || `CSV Contact ${contacts.length + 1}`
    });
  }

  return { contacts, errors };
}
