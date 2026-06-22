// Vitest setup for React Testing Library (task 1.4).
// Adds jest-dom matchers (toBeInTheDocument, etc.) and clears the DOM
// between tests.
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});
