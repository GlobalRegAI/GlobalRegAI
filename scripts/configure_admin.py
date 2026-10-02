"""Generate hosting-environment values locally. Never commit the output."""
import getpass
import hashlib
import secrets


def main():
    username = input('Administrator username: ').strip()
    password = getpass.getpass('Administrator password (at least 16 characters): ')
    if not username or len(password) < 16:
        raise SystemExit('A username and a password of at least 16 characters are required.')
    if password != getpass.getpass('Confirm password: '):
        raise SystemExit('Passwords do not match.')
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac('sha256', password.encode(), bytes.fromhex(salt), 600000).hex()
    print('\nEnter these values separately into the hosting environment settings. Do not commit or paste into a shell:')
    print('GLOBALREGAI_ADMIN_USER: '+username)
    print('GLOBALREGAI_ADMIN_PASSWORD_HASH: '+f'pbkdf2_sha256$600000${salt}${digest}')
    print('GLOBALREGAI_SESSION_SECRET: '+secrets.token_urlsafe(48))


if __name__ == '__main__':
    main()
