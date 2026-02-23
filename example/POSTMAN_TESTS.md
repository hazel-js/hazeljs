# HazelJS API Tests - Postman Collection

This Postman collection provides comprehensive API testing for all HazelJS example endpoints.

## 📦 What's Included

### 1. **Cache API** (10 endpoints)
- Get with Memory Cache
- Get with Tags
- Get with Custom TTL
- Create User (Cache Evict)
- Delete Cache Entry
- Invalidate by Tag
- Get Cache Stats
- Warm Up Cache
- Test Cache-Aside Pattern
- Clear All Cache

### 2. **Serverless API** (5 endpoints)
- Hello Serverless
- Optimized Endpoint
- Process Data
- Get Metrics
- Health Check

### 3. **Demo API** (6 endpoints)
- Optional Parameter
- Wildcard Route
- Scoped Provider
- Config Example
- Versioned Endpoint (v1)
- Versioned Endpoint (v2)

### 4. **Authentication** (3 endpoints)
- Login
- Register
- Get Profile

### 5. **AI Jobs** (3 endpoints)
- Enhance Job Description
- Validate Job Description
- Extract Skills

### 6. **PDF-to-Audio API** (3 endpoints, async)
- Submit PDF for Conversion — `POST /api/pdf-to-audio/convert` (multipart/form-data). Returns `{ jobId }` (202).
- Get Job Status — `GET /api/pdf-to-audio/status/:jobId`. Returns `{ status, progress, ... }`.
- Download Audio — `GET /api/pdf-to-audio/download/:jobId`. Returns MP3 when job is completed.
- Requires `OPENAI_API_KEY`. Run "Submit" first, poll "Status" until completed, then "Download".

### 7. **Kafka API** (2 endpoints)
- Create Order — `POST /kafka/orders/` (run with `npm run kafka` on port 3010)
- Publish Order Event — `POST /kafka/orders/events`

### 8. **Documentation** (2 endpoints)
- Get Swagger UI
- Get OpenAPI Spec

## 🚀 Getting Started

### Prerequisites
1. **Postman** installed ([Download here](https://www.postman.com/downloads/))
2. **HazelJS server** running on `http://localhost:3000`

### Import Collection

1. Open Postman
2. Click **Import** button
3. Select `hazeljs-api-tests.postman_collection.json`
4. Collection will be imported with all tests

### Configure Environment

The collection uses two variables:

```json
{
  "baseUrl": "http://localhost:3000",
  "authToken": ""
}
```

- `baseUrl`: Your HazelJS server URL (default: `http://localhost:3000`)
- `authToken`: JWT token (automatically set after login)

## 🧪 Running Tests

### Run All Tests

1. Click on the collection name
2. Click **Run** button
3. Select all folders
4. Click **Run HazelJS API Tests**

### Run Specific Folder

1. Right-click on a folder (e.g., "Cache API")
2. Click **Run folder**

### Run Single Request

1. Click on a request
2. Click **Send** button
3. View response and test results

## ✅ Test Coverage

Each request includes automated tests:

### Response Validation
```javascript
pm.test("Status code is 200", function () {
    pm.response.to.have.status(200);
});
```

### Data Structure Validation
```javascript
pm.test("Response has required fields", function () {
    var jsonData = pm.response.json();
    pm.expect(jsonData).to.have.property('id');
    pm.expect(jsonData).to.have.property('data');
});
```

### Performance Testing
```javascript
pm.test("Response time is less than 2000ms", function () {
    pm.expect(pm.response.responseTime).to.be.below(2000);
});
```

## 📊 Expected Test Results

When running all tests with the server running:

```
✓ Cache API (10/10 tests passed)
✓ Serverless API (5/5 tests passed)
✓ Demo API (6/6 tests passed)
✓ Authentication (3/3 tests passed)
✓ AI Jobs (3/3 tests passed)
✓ PDF-to-Audio API (3/3 tests passed — run Submit, then poll Status until completed, then Download)
✓ Kafka API (2/2 tests passed — use baseUrl http://localhost:3010 and run `npm run kafka`)
✓ Documentation (2/2 tests passed)

Total: 34+/34+ tests passed
```

## 🔧 Troubleshooting

### Server Not Running
**Error**: `Error: connect ECONNREFUSED 127.0.0.1:3000`

**Solution**: Start the HazelJS server:
```bash
cd example
npm run dev
```

### Authentication Required
**Error**: `401 Unauthorized`

**Solution**: Run the "Login" request first to get an auth token

### Cache Tests Failing
**Solution**: Run "Clear All Cache" request first to reset cache state

### Port Conflict
**Solution**: Update the `baseUrl` variable to match your server port

### PDF-to-Audio Requires OpenAI Key
**Solution**: Set `OPENAI_API_KEY` in your environment. 1) Submit a PDF via "Submit PDF for Conversion" (form-data → file). 2) Poll "Get Job Status" until status is `completed`. 3) Call "Download Audio" to get the MP3.

### Kafka Tests
**Solution**: Kafka runs as a separate app. Run `npm run kafka` (starts on port 3010), then set `baseUrl` to `http://localhost:3010` for Kafka API requests.

## 📝 Test Scenarios

### Scenario 1: Cache Flow
1. Clear All Cache
2. Get with Memory Cache (miss)
3. Get with Memory Cache (hit)
4. Get Cache Stats
5. Invalidate by Tag

### Scenario 2: Serverless Flow
1. Hello Serverless (cold start)
2. Hello Serverless (warm start)
3. Process Data
4. Get Metrics
5. Health Check

### Scenario 3: Authentication Flow
1. Register
2. Login (saves token)
3. Get Profile (uses token)

### Scenario 4: Demo Features
1. Optional Parameter
2. Wildcard Route
3. Scoped Provider
4. Config Example
5. Versioned Endpoint v1
6. Versioned Endpoint v2

## 🎯 Advanced Usage

### Environment Variables

Create different environments for different stages:

**Development**
```json
{
  "baseUrl": "http://localhost:3000",
  "authToken": ""
}
```

**Staging**
```json
{
  "baseUrl": "https://staging.example.com",
  "authToken": ""
}
```

**Production**
```json
{
  "baseUrl": "https://api.example.com",
  "authToken": ""
}
```

### Collection Runner

Run tests in CI/CD:

```bash
# Install Newman (Postman CLI)
npm install -g newman

# Run collection
newman run hazeljs-api-tests.postman_collection.json \
  --environment your-environment.json \
  --reporters cli,json

# Run with specific folder
newman run hazeljs-api-tests.postman_collection.json \
  --folder "Cache API"
```

### Pre-request Scripts

The collection includes global pre-request scripts:

```javascript
// Log request URL
console.log('Request to: ' + pm.request.url);
```

### Global Tests

All requests include a performance test:

```javascript
pm.test("Response time is less than 2000ms", function () {
    pm.expect(pm.response.responseTime).to.be.below(2000);
});
```

## 📚 API Documentation

For detailed API documentation, visit:
- Swagger UI: `http://localhost:3000/swagger`
- OpenAPI Spec: `http://localhost:3000/swagger/spec`

## 🤝 Contributing

To add new tests:

1. Add request to appropriate folder
2. Add test scripts
3. Update this README
4. Test locally
5. Submit PR

## 📄 License

Apache 2.0 - see LICENSE file for details

## 🔗 Links

- [HazelJS Documentation](../README.md)
- [Postman Documentation](https://learning.postman.com/)
- [Newman CLI](https://github.com/postmanlabs/newman)

---

**Total Endpoints**: 32+  
**Total Tests**: 32+  
**Coverage**: 100%  
**Last Updated**: February 2025
