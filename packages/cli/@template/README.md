# HazelJS Starter App

This project was generated with the [HazelJS CLI](https://github.com/your-org/hazeljs) and serves as a starting point for building scalable, modular Node.js applications with TypeScript.

## Features

- **TypeScript-first**: All code and configs are TypeScript.
- **Decorator-based API**: Clean, intuitive module/controller/service structure.
- **Built-in Dependency Injection**.
- **Validation, Guards, Interceptors, and Middleware** support.
- **Swagger/OpenAPI** integration out of the box.
- **Ready for Testing**: Includes Jest setup.

## Project Structure

```
src/
  core/           # HazelJS core framework (decorators, pipes, guards, swagger, types)
  example/        # Example application code
  index.ts        # Main entry point
```

## Getting Started

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Run the app:**
   ```bash
   npm run start
   ```

3. **Run tests:**
   ```bash
   npm test
   ```

4. **Build for production:**
   ```bash
   npm run build
   ```

## Example Usage

- See `src/example/` for a sample module, controller, and DTO.
- Modify or add modules/controllers/services in `src/` as needed.

## Customization

- Edit `src/core/` to extend or override framework features.
- Add new modules, controllers, services, DTOs, and middleware as your app grows.

## Documentation

- See the [HazelJS documentation](https://github.com/your-org/hazeljs) for more details on decorators, DI, validation, and advanced features.

## License

MIT 