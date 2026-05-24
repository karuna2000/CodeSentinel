# CodeSintler (next-temp)

This is a modern web application built using **Next.js**, **React**, and **TypeScript**. It is configured with various tools to ensure high performance, code quality, and testability.

## 🚀 Technologies Used

- **Framework**: [Next.js](https://nextjs.org/) (App Router ready)
- **UI & Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Linting & Formatting**: [ESLint](https://eslint.org/)
- **Testing**: 
  - Unit Tests: [Vitest](https://vitest.dev/)
  - End-to-End Tests: [Playwright](https://playwright.dev/)

## 📦 Getting Started

### Prerequisites
Make sure you have Node.js and npm (or pnpm/yarn) installed.

### Installation

Clone the repository and install the dependencies:

```bash
# Install dependencies
npm install
```

### Running the Development Server

Start the development server with hot-reloading:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## 🛠️ Scripts

- `npm run dev`: Starts the Next.js development server.
- `npm run build`: Builds the application for production.
- `npm run start`: Starts the production server.
- `npm run lint`: Runs ESLint to catch formatting and code quality issues.

## 📂 Project Structure

- `src/`: Contains the main application source code (components, pages, etc.).
- `middleware.ts`: Next.js middleware file for edge computing logic.
- `instrumentation.ts`: Application monitoring and instrumentation setup.
- `*.config.*`: Configuration files for Next.js, Tailwind, Vite, Vitest, ESLint, and Playwright.
