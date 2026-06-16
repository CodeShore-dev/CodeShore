// Single enforced entry point for the project rule: page navigation and
// pagination changes must reset scroll to the top. Router scrollBehavior
// and Pagination.vue both call this — new features should too, instead
// of re-implementing scroll resets locally.
export const scrollToTop = (): void => {
  window.scrollTo(0, 0);
};
