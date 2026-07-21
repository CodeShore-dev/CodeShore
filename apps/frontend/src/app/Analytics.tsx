import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router';

import { env } from '../config/env';

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

// GA4 disabled unless a measurement ID is configured, and always disabled in
// dev so local work never pollutes production analytics.
const isEnabled = Boolean(env.gaMeasurementId) && !env.isDev;

// Loads gtag.js once and fires a page_view on every SPA route change.
// gtag's own automatic page_view only fires on the initial script load; it
// never observes react-router's pushState navigations, so each route change
// is reported manually here (mirrors ScrollManager's location-effect shape).
export function Analytics() {
  const location = useLocation();
  const initialized = useRef(false);

  useEffect(() => {
    if (!isEnabled || initialized.current) return;
    initialized.current = true;

    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${env.gaMeasurementId}`;
    document.head.appendChild(script);

    window.dataLayer = window.dataLayer ?? [];
    window.gtag = function gtag(...args: unknown[]) {
      window.dataLayer.push(args);
    };
    // No cookie-consent banner exists on this site, so grant storage consent
    // by default — otherwise gtag.js defaults analytics_storage to "denied"
    // and silently drops every hit (no cookie, no network request, no error).
    window.gtag('consent', 'default', {
      analytics_storage: 'granted',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
    });
    window.gtag('js', new Date());
    // send_page_view disabled here; the location effect below reports every
    // page_view (including the first) so there is exactly one per route.
    window.gtag('config', env.gaMeasurementId, { send_page_view: false });
  }, []);

  useEffect(() => {
    if (!isEnabled || !initialized.current) return;

    window.gtag('event', 'page_view', {
      page_path: `${location.pathname}${location.search}`,
      page_title: document.title,
      page_location: window.location.href,
    });
  }, [location]);

  return null;
}
