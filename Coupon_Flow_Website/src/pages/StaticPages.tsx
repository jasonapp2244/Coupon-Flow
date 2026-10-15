import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Mail } from 'lucide-react';
import { usePageMeta } from '../lib/hooks';
import { useSite } from '../store/site';

function InfoPage({ title, description, updated, children }: { title: string; description: string; updated?: string; children: ReactNode }) {
  usePageMeta(title, description);
  return (
    <div className="mx-auto max-w-2xl px-4 py-14">
      <h1 className="page-title">{title}</h1>
      {updated && <p className="mt-2 text-sm text-muted">Last updated {updated}</p>}
      <div className="prose-body mt-4">{children}</div>
    </div>
  );
}

function SupportLink() {
  const { support_email } = useSite();
  return support_email
    ? <a href={`mailto:${support_email}`} className="font-semibold text-ink underline">{support_email}</a>
    : <Link to="/contact" className="font-semibold text-ink underline">our contact page</Link>;
}

const UPDATED = 'October 5, 2026';

export function AboutPage() {
  const { site_name } = useSite();
  return (
    <InfoPage title={`About ${site_name}`} description={`${site_name} collects working coupon codes and deals for the stores you already shop.`}>
      <p>{site_name} collects coupon codes and deals for stores people actually shop at, and keeps only the ones that are live.</p>
      <h2>Free codes and deals</h2>
      <p>Every code on the site is free. Press Show coupon code: the store opens in a new tab and the code waits for you here. Copy it and paste it at the store's checkout. Deals need no code: the discount applies when you open the store through our link.</p>
      <h2>How we earn money</h2>
      <p>When you buy something after following one of our links, the store may pay us a commission. It never changes the price you pay. Read the <Link to="/affiliate-disclosure" className="underline">affiliate disclosure</Link> for details.</p>
    </InfoPage>
  );
}

export function ContactPage() {
  const { site_name, support_email } = useSite();
  return (
    <InfoPage title="Contact us" description={`How to reach the ${site_name} team about a code or a store.`}>
      <p>Questions about a code that didn't work, or a store you'd like us to add? Email us and we'll reply within two working days.</p>
      {support_email ? (
        <p>
          <a href={`mailto:${support_email}`} className="btn-primary"><Mail size={16} aria-hidden="true" /> {support_email}</a>
        </p>
      ) : (
        <p>Our support email address will be listed here shortly.</p>
      )}
      <h2>A code didn't work</h2>
      <p>Tell us the store, the code and what the store's checkout said.</p>
    </InfoPage>
  );
}

export function TermsPage() {
  const { site_name } = useSite();
  return (
    <InfoPage title="Terms of use" updated={UPDATED} description={`The terms for using ${site_name}.`}>
      <p>By using {site_name} you agree to these terms. If you don't agree, please don't use the site.</p>
      <h2>Coupons and deals</h2>
      <p>Offers are set by the stores, not by us. We check codes, but a store can change or end an offer at any time, and each store's own terms decide how a code can be used.</p>
      <h2>Liability</h2>
      <p>The site is provided as it is. Codes and deals are free and offered without any guarantee that a store will accept them.</p>
      <h2>Contact</h2>
      <p>Questions about these terms: <SupportLink />.</p>
    </InfoPage>
  );
}

export function PrivacyPage() {
  const { site_name } = useSite();
  return (
    <InfoPage title="Privacy policy" updated={UPDATED} description={`What ${site_name} collects, why, and how to have it removed.`}>
      <p>This policy explains what {site_name} collects when you use the site and what we do with it.</p>
      <h2>What we collect</h2>
      <ul>
        <li>Clicks: when you reveal a code or open a deal we record the coupon and the time, so we know which offers work.</li>
        <li>Store ratings: the stars you give a store, with a scrambled code made from your connection and browser so each visitor votes once. We don't keep your IP address.</li>
      </ul>
      <h2>Why we use it</h2>
      <p>To answer support requests and improve which offers we list. We don't sell your data.</p>
      <h2>Who else sees it</h2>
      <p>Our hosting and email providers store data on our behalf. Stores see that a visit came from us, not who you are.</p>
      <h2>Your choices</h2>
      <p>To ask what we hold or have it deleted, email <SupportLink />.</p>
      <h2>Cookies and storage</h2>
      <p>We keep the stars you gave a store in your browser's storage. We don't use advertising cookies.</p>
    </InfoPage>
  );
}

export function AffiliateDisclosurePage() {
  const { site_name } = useSite();
  return (
    <InfoPage title="Affiliate disclosure" updated={UPDATED} description={`How ${site_name} earns money from store links.`}>
      <p>Many links on {site_name} are affiliate links. When you follow one and buy something, the store may pay us a commission.</p>
      <p>The commission comes from the store. It never raises your price, and it doesn't decide which codes we list: an offer is shown because it works, whether or not it earns us anything.</p>
    </InfoPage>
  );
}
