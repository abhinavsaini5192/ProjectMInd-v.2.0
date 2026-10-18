# Local Development & Testing Guide

## 1. Setup

Prerequisites:
- Node.js 20+
- npm 10+

```bash
# Clone repository
git clone https://github.com/abhinavsaini5192/ProjectMind.git
cd ProjectMind

# Install dependencies
npm install

# Run test suite
npm test
```

## 2. Local Development Profile

For development work:
- `PROJECTMIND_ENV=development`
- `PROJECTMIND_LOG_LEVEL=DEBUG`
- `PROJECTMIND_LOG_FORMAT=pretty`
- `PROJECTMIND_STORAGE_TYPE=memory`

This enables pretty-printed logs with millisecond timestamps and in-memory storage for rapid experimentation without polluting disk state.
