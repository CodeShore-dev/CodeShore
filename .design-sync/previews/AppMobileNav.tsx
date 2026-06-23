import { AppMobileNav } from 'codeshore';

// AppMobileNav ships as `position: fixed; bottom: 0` and `md:hidden`, so it is
// invisible at a desktop-width capture viewport. The scoped style forces it
// visible (overriding md:hidden's display:none) and in-flow (static instead of
// fixed) so the bar lands inside the captured card box. The 390px wrapper keeps
// it phone-width, which is how the bar is meant to appear.
export const Default = () => (
  <div id="ds-mobilenav-preview" style={{ position: 'relative', width: 390 }}>
    <style>{`#ds-mobilenav-preview nav{position:static !important;display:flex !important;}`}</style>
    <AppMobileNav />
  </div>
);
