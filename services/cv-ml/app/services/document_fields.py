"""Conservative ID extraction and ICAO TD3 consistency checks; not authenticity proof."""
from datetime import date, datetime
import re


def check_digit(text):
    if not re.fullmatch(r'[A-Z0-9<]+', text):
        raise ValueError('Invalid MRZ characters')
    values = [0 if char == '<' else int(char) if char.isdigit() else ord(char) - 55 for char in text]
    return str(sum(value * (7, 3, 1)[index % 3] for index, value in enumerate(values)) % 10)


def mrz_date(value, birth, today):
    if not re.fullmatch(r'\d{6}', value):
        raise ValueError('Incomplete MRZ date')
    year, month, day = int(value[:2]), int(value[2:4]), int(value[4:])
    year += 2000
    if birth and (year, month, day) > (today.year, today.month, today.day):
        year -= 100
    # Expiry century is inferred only within a bounded window; old specimens fail safely.
    if not birth and year > today.year + 20:
        year -= 100
    return date(year, month, day)


def parse_td3(lines, today):
    candidates = [re.sub(r'\s+', '', line.upper()) for line in lines]
    if sum(line.startswith('P<') for line in candidates) > 1:
        return {}, ['MULTIPLE_MRZ_DOCUMENTS'], False
    for index, top in enumerate(candidates[:-1]):
        if not top.startswith('P<'):
            continue
        bottom = candidates[index + 1]
        if len(top) != 44 or len(bottom) != 44 or not re.fullmatch(r'[A-Z<]{44}', top) or not re.fullmatch(r'[A-Z0-9<]{44}', bottom):
            return {}, ['MRZ_UNREADABLE'], False
        tests = [(bottom[:9], bottom[9]), (bottom[13:19], bottom[19]),
                 (bottom[21:27], bottom[27]), (bottom[28:42], bottom[42]),
                 (bottom[:10] + bottom[13:20] + bottom[21:43], bottom[43])]
        if any(check_digit(value) != (digit if digit != '<' else '0') for value, digit in tests):
            return {}, ['MRZ_CHECK_DIGIT_MISMATCH'], False
        try:
            dob, expiry = mrz_date(bottom[13:19], True, today), mrz_date(bottom[21:27], False, today)
            if dob > today or dob.year < today.year - 120 or expiry <= dob:
                raise ValueError('Invalid MRZ date ordering')
        except ValueError:
            return {}, ['MRZ_INVALID_DATES'], False
        name = ' '.join(top[5:].replace('<', ' ').split())
        number = bottom[:9].rstrip('<')
        if not re.fullmatch(r'[A-Z0-9]{3,9}', number) or not name:
            return {}, ['MRZ_INCOMPLETE_IDENTITY'], False
        return {'idNumber': number, 'dob': dob.isoformat(),
                'expiryDate': expiry.isoformat(), 'name': name}, [], True
    return {}, [], False


LABELS = {
    'idNumber': r'(?:ID(?:ENTITY)?(?:\s+(?:CARD|DOCUMENT))?\s*(?:NUMBER|NO\.?|#)?|NIN|PASSPORT\s*(?:NUMBER|NO\.?|#))',
    'dob': r'(?:DATE\s+OF\s+BIRTH|DOB|BIRTH\s+DATE)',
    'expiryDate': r'(?:DATE\s+OF\s+EXPIRY|EXPIRY\s+DATE|EXPIRATION\s+DATE|EXPIRES)',
    'name': r'(?:FULL\s+NAME|NAME)',
}


def parse_date(value):
    value = value.strip().upper()
    for pattern in ('%Y-%m-%d', '%d %b %Y', '%d %B %Y'):
        try:
            return datetime.strptime(value, pattern).date()
        except ValueError:
            pass
    # Refuse ambiguous numeric dates; do not guess the issuing country's convention.
    if re.fullmatch(r'\d{2}[/.-]\d{2}[/.-]\d{4}', value):
        day, month, year = re.split(r'[/.-]', value)
        if int(day) > 12:
            return date(int(year), int(month), int(day))
    raise ValueError('Unreadable or ambiguous date')


def extract_document_fields(lines, today=None):
    today = today or date.today()
    fields, signals, mrz_valid = parse_td3(lines, today)
    labelled = {}
    for index, line in enumerate(lines):
        for key, label in LABELS.items():
            match = re.fullmatch(label + r'(?:\s*[:=]\s*|\s+|$)(.*)', line.strip(), flags=re.I)
            if not match:
                continue
            value = match[1].strip()
            if not value and index + 1 < len(lines):
                value = lines[index + 1].strip()
            try:
                if key == 'idNumber':
                    value = value.upper()
                    if not re.fullmatch(r'[A-Z0-9][A-Z0-9-]{2,39}', value):
                        raise ValueError('Invalid document number')
                elif key in ('dob', 'expiryDate'):
                    value = parse_date(value).isoformat()
                elif not 2 <= len(value) <= 120 or any(char.isdigit() for char in value):
                    raise ValueError('Invalid name')
                labelled.setdefault(key, set()).add(value)
            except ValueError:
                signals.append('UNREADABLE_' + key.upper())
    for key, values in labelled.items():
        if len(values) != 1:
            fields.pop(key, None); signals.append('CONFLICTING_' + key.upper())
            continue
        value = next(iter(values))
        if key in fields and key != 'name' and fields[key] != value:
            fields.pop(key); signals.append('MRZ_PRINTED_FIELD_MISMATCH')
        elif key not in fields:
            fields[key] = value
    if 'dob' in fields:
        dob = date.fromisoformat(fields['dob'])
        if dob > today or dob.year < today.year - 120:
            fields.pop('dob'); signals.append('INVALID_DATE_OF_BIRTH')
    if 'expiryDate' in fields:
        expiry = date.fromisoformat(fields['expiryDate'])
        if expiry < today:
            signals.append('DOCUMENT_EXPIRED')
        if 'dob' in fields and expiry <= date.fromisoformat(fields['dob']):
            signals.append('INVALID_DOCUMENT_DATES')
    if not all(key in fields for key in ('idNumber', 'dob')):
        signals.append('REQUIRED_ID_FIELDS_UNREADABLE')
    if 'expiryDate' not in fields:
        signals.append('EXPIRY_NOT_ESTABLISHED')
    return {'extractedFields': fields, 'signals': sorted(set(signals)), 'mrzChecksumValid': mrz_valid,
            'authenticityEstablished': False}
