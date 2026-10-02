"""Server-only provider configuration, including migration from the former API.

Only one credential is selected. Do not rotate keys to work around provider quotas.
New installations should use GROQ_API_KEY; VITE_ names are migration compatibility.
"""
import os

KEY_NAMES = ('GROQ_API_KEY', 'VITE_GROQ_API_KEY', 'VITE_GROQ_API_KEY_1',
             'VITE_GROQ_API_KEY_2', 'VITE_GROQ_API_KEY_3')


def groq_key():
    return next((os.environ[name].strip() for name in KEY_NAMES if os.getenv(name, '').strip()), '')


def configured():
    return provider() == 'groq' and bool(groq_key())


def provider():
    # Opt in explicitly. Stored credentials never silently enable billable inference.
    value = os.getenv('GLOBALREGAI_AI_PROVIDER', 'none').strip().lower()
    return value if value in {'none', 'groq'} else 'none'


def configuration_status():
    return {'configured': configured(),
            'legacy_variable_in_use': not bool(os.getenv('GROQ_API_KEY', '').strip()) and configured()}
