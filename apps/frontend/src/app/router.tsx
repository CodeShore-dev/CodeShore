import { createBrowserRouter } from 'react-router';

// Placeholder route table for the foundation skeleton (task 1.2).
// The full 10-route table, guards, and ScrollManager are wired in task 10.1.
export const router = createBrowserRouter(
  [
    {
      path: '/',
      element: (
        <div className="p-8 text-[#001f2a]">
          CodeShore — React migration foundation is booting.
        </div>
      ),
    },
  ],
  { basename: import.meta.env.BASE_URL },
);
