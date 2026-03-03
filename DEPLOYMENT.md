# Production Deployment Guide

## Overview
This document outlines the production-ready configuration for BranChat, a privacy-first chat application using Chrome's Built-in AI APIs.

## Security & Production Changes Made

### ✅ Completed Tasks
1. **Removed Debug Logs**: All console.log statements removed from production code
2. **Environment Validation**: Added graceful failure for missing optional services
3. **No Hardcoded Secrets**: All sensitive data moved to environment variables
4. **Production .env Examples**: Created clean configuration templates
5. **Comprehensive .gitignore**: Prevents secrets from being committed
6. **Error Handling**: Centralized error handling with production-safe messages
7. **Optional Services**: Elasticsearch and Gemini API are now optional

### 🔒 Security Features
- JWT secret validation (fails if default value used)
- Environment variable validation on startup
- Production-safe error messages
- CORS configuration for production domains
- Rate limiting enabled by default

## Environment Configuration

### Required Variables
```bash
# Database
MONGODB_URI=mongodb://localhost:27017/branchat

# Authentication
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
```

### Optional Variables
```bash
# AI Fallback (Optional - Chrome AI is primary)
GEMINI_API_KEY=your-gemini-api-key-here

# Memory Features (Optional)
ELASTIC_URL=http://localhost:9200
ELASTIC_USERNAME=elastic
ELASTIC_PASSWORD=your-elastic-password
```

## Deployment Steps

### 1. Environment Setup
```bash
# Copy production environment template
cp backend/.env.production.example backend/.env
cp frontend/.env.production.example frontend/.env

# Edit with your values
nano backend/.env
nano frontend/.env
```

### 2. Install Dependencies
```bash
# Backend
cd backend
npm install --production

# Frontend
cd ../frontend
npm install --production
```

### 3. Build Frontend
```bash
cd frontend
npm run build
```

### 4. Start Services
```bash
# Start MongoDB (required)
# Start Elasticsearch (optional for memory features)

# Start Backend
cd backend
npm start
```

## Service Health Checks

### Backend Health
```bash
curl http://localhost:3001/health
```

### Environment Validation
The application automatically validates:
- Required environment variables on startup
- JWT secret is not default value
- Database connectivity
- Optional service availability with warnings

## Chrome Built-in AI Configuration

### User Requirements
- Chrome 127+ (Canary/Dev/Beta recommended)
- Enable flags:
  - `chrome://flags/#optimization-guide-on-device-model`
  - `chrome://flags/#prompt-api-for-gemini-nano`
- Restart Chrome (auto-downloads Gemini Nano ~1-2GB)

### Fallback Strategy
- **Primary**: Chrome Built-in AI (privacy-first, on-device)
- **Fallback**: Gemini API (if configured)
- **Final**: Mock responses (development only)

## Monitoring & Logging

### Log Levels
- `error`: Critical errors only
- `warn`: Warnings for missing optional services
- `info`: General operational messages
- `debug`: Detailed debugging (development only)

### Production Logs
- Error logs: `logs/error.log`
- Combined logs: `logs/combined.log`
- Console: Structured JSON logging

## Security Checklist

### Before Production Deployment
- [ ] Change JWT_SECRET from default value
- [ ] Set correct CORS_ORIGIN for your domain
- [ ] Configure production MongoDB URI
- [ ] Set NODE_ENV=production
- [ ] Review rate limiting settings
- [ ] Configure SSL/TLS termination
- [ ] Set up monitoring and alerting

### Environment Security
- [ ] Store .env files securely
- [ ] Use different secrets for development/staging/production
- [ ] Rotate secrets regularly
- [ ] Use environment-specific API keys

## Docker Deployment (Optional)

```bash
# Build production image
cd backend
docker build -t branchat-backend .

# Run with environment file
docker run --env-file .env branchat-backend
```

## Troubleshooting

### Common Issues
1. **Environment validation failed**: Check required variables
2. **Database connection failed**: Verify MongoDB URI and accessibility
3. **Chrome AI not working**: Check browser flags and Chrome version
4. **CORS errors**: Update CORS_ORIGIN to match frontend domain

### Debug Mode
Enable debug logging by setting:
```bash
LOG_LEVEL=debug
VITE_CHROME_AI_DEBUG=true  # Frontend only
```

## Performance Considerations

### Chrome Built-in AI Benefits
- **Latency**: ~100-500ms (no network)
- **Privacy**: 100% on-device processing
- **Cost**: $0 per request
- **Offline**: Works without internet

### Server Load
- Minimal when Chrome AI is available
- Increased when falling back to Gemini API
- Memory features require Elasticsearch

## Support

For production issues:
1. Check application logs
2. Verify environment configuration
3. Test service health endpoints
4. Review Chrome AI requirements

## License

MIT License - see LICENSE file for details.
