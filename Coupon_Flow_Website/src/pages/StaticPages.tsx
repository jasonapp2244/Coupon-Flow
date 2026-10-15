import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Mail } from 'lucide-react';
import { PageHeader } from '../components/States';
import { usePageMeta } from '../lib/hooks';
import { useSite } from '../store/site';

function InfoPage({ title, description, intro, updated, children }: { title: string; description: string; intro?: string; updated?: string; children: ReactNode }) {
  usePageMeta(title, description);
  return (
    <>
      <PageHeader title={title} intro={updated ? <span className="text-sm text-muted">Last updated {updated}</span> : intro} />
      <div className="page py-10">
        <div className="panel prose-body max-w-3xl px-6 pb-8 pt-4 sm:px-10 sm:pb-10">{children}</div>
      </div>
    </>
  );
}

function SupportLink() {
  const { support_email } = useSite();
  return support_email
    ? <a href={`mailto:${support_email}`} className="font-semibold text-ink underline">{support_email}</a>
    : <Link to="/contact" className="font-semibold text-ink underline">our contact page</Link>;
}

const UPDATED = 'October 16, 2026';

export function AboutPage() {
  const { site_name } = useSite();
  return (
    <InfoPage title={`About ${site_name}`} intro="A simple way to pay less at the stores you love."
      description={`${site_name} gathers free promo codes and deals from popular stores in one place, so you can save in seconds before you pay.`}>
      <p>Most of us have sat at a checkout, spotted the promo code box and wondered whether we were about to pay more than we needed to. {site_name} exists to answer that question quickly. We gather coupon codes and deals from popular stores in one place, so you can find a discount in seconds and get back to your shopping.</p>

      <h2>How it works</h2>
      <p>Search for a store or browse by category. When you see an offer you like, click <strong>Show coupon code</strong>. The store opens in a new tab and the code is waiting for you here, ready to copy. Paste it into the promo code box at checkout and the discount is applied.</p>
      <p>Some offers are deals rather than codes. For those, there is nothing to copy: the saving is applied when you visit the store through our link.</p>

      <h2>How we choose offers</h2>
      <p>We focus on stores people actually shop at and on offers that are useful, such as money off, free shipping and sale events. Every offer shows its expiry date where the store provides one, and expired offers are removed from the site. Stores can change or end a promotion without notice, so if a code doesn't work, <Link to="/contact">let us know</Link> and we'll look into it.</p>

      <h2>Always free</h2>
      <p>You never pay to use {site_name}, and you don't need an account. There are no apps to install and no personal details to hand over.</p>

      <h2>How we keep the lights on</h2>
      <p>When you follow a link to a store and make a purchase, the store may pay us a small commission. This never changes the price you pay. You can read more in our <Link to="/affiliate-disclosure">affiliate disclosure</Link>.</p>
    </InfoPage>
  );
}

export function ContactPage() {
  const { site_name, support_email } = useSite();
  return (
    <InfoPage title="Contact us" intro="Questions, feedback or a code that didn't work? We'd like to hear from you."
      description={`Get in touch with the ${site_name} team about a coupon code, a store or a partnership.`}>
      {support_email ? (
        <>
          <p>The quickest way to reach us is by email. We read every message and reply as soon as we can.</p>
          <p><a href={`mailto:${support_email}`} className="btn-primary"><Mail size={16} aria-hidden="true" /> {support_email}</a></p>
        </>
      ) : (
        <p>We read every message and reply as soon as we can. Our contact details are being set up, so please check back here shortly.</p>
      )}

      <h2>Reporting a code that didn't work</h2>
      <p>Tell us which store it was, the code you used and the message the store's checkout showed. A screenshot helps too. We'll check the offer and update or remove it.</p>

      <h2>Suggesting a store</h2>
      <p>Is there a store you'd like to see on {site_name}? Send us its name and website address and we'll look at adding it.</p>

      <h2>Brands and partnerships</h2>
      <p>If you represent a store and would like your offers listed, or want to correct an existing offer, email us with the details and the best person to contact.</p>
    </InfoPage>
  );
}

export function TermsPage() {
  const { site_name } = useSite();
  return (
    <InfoPage title="Terms of use" updated={UPDATED} description={`The terms that apply when you use ${site_name}.`}>
      <p>These terms explain the rules for using {site_name}. By using the site you agree to them. If you don't agree, please don't use the site.</p>

      <h2>Using {site_name}</h2>
      <p>{site_name} is a free service that lists coupon codes and deals offered by other stores. You may use the site for your own personal, non-commercial shopping.</p>

      <h2>Offers and prices</h2>
      <p>Every offer is set by the store, not by us. We work to keep listings accurate, but a store can change, limit or end a promotion at any time. Each store's own terms decide who can use an offer, what it applies to and how long it lasts. Always check the final price at the store's checkout before you pay.</p>

      <h2>Links to other websites</h2>
      <p>The site links to stores and other websites that we don't control. When you follow a link, the other site's terms and privacy policy apply. Any purchase you make is between you and that store, including payment, delivery, returns and refunds.</p>

      <h2>Acceptable use</h2>
      <p>Please don't misuse the site. That includes copying our listings in bulk, using automated tools to collect codes, interfering with how the site works, or trying to get around limits on how many codes one visitor can claim.</p>

      <h2>Our content</h2>
      <p>The design, text and articles on {site_name} belong to us or are used with permission. Store names and logos belong to their owners and are shown only to identify the store.</p>

      <h2>No guarantee</h2>
      <p>The site is provided "as is". We can't guarantee that every code will work or that the site will always be available. To the extent the law allows, we aren't responsible for losses that come from using the site or from a store's decision to accept or refuse an offer.</p>

      <h2>Changes to these terms</h2>
      <p>We may update these terms from time to time. The date at the top of this page shows when they last changed.</p>

      <h2>Contact</h2>
      <p>Questions about these terms? Reach us through <SupportLink />.</p>
    </InfoPage>
  );
}

export function PrivacyPage() {
  const { site_name } = useSite();
  return (
    <InfoPage title="Privacy policy" updated={UPDATED} description={`What information ${site_name} collects, why we collect it and the choices you have.`}>
      <p>Your privacy matters to us. This policy explains what information {site_name} collects when you use the site, why we collect it and what we do with it. You don't need an account to use {site_name}, so we collect very little.</p>

      <h2>Information we collect</h2>
      <ul>
        <li><strong>Offer clicks.</strong> When you reveal a code or open a deal, we record which offer it was and when. This tells us which offers are useful.</li>
        <li><strong>Visitor code.</strong> To limit how many codes one visitor can claim, and to count each store rating once, we create a one-way code from your connection and browser details. It can't be turned back into your IP address, and we don't store your IP address with it.</li>
        <li><strong>Store ratings.</strong> If you rate a store, we save the star rating you chose.</li>
        <li><strong>Messages you send.</strong> If you email us, we keep your message and email address so we can reply.</li>
        <li><strong>Server logs.</strong> Like most websites, our hosting provider keeps short-term technical logs to keep the site secure and working.</li>
      </ul>

      <h2>How we use it</h2>
      <p>We use this information to run the site, decide which offers to show, prevent abuse and answer your questions. We don't sell your information, and we don't use it for advertising profiles.</p>

      <h2>Who we share it with</h2>
      <p>Our hosting and email providers process data on our behalf. When you follow a link to a store, the store and its affiliate network can see that the visit came from {site_name} so they can pay any commission. They don't receive your name or contact details from us.</p>

      <h2>Cookies and browser storage</h2>
      <p>We don't use advertising or tracking cookies. Your browser stores the star ratings you've given, and, for the current visit only, the codes you've revealed, so they're still there if you refresh the page. You can clear this storage in your browser settings at any time. Stores you visit may set their own cookies under their own policies.</p>

      <h2>How long we keep it</h2>
      <p>We keep click and rating records for as long as they help us run the site, and emails for as long as we need them to deal with your request.</p>

      <h2>Your choices</h2>
      <p>You can ask what information we hold about you, or ask us to delete it, by contacting us through <SupportLink />.</p>

      <h2>Changes to this policy</h2>
      <p>If we change this policy, we'll update the date at the top of this page.</p>
    </InfoPage>
  );
}

export function AffiliateDisclosurePage() {
  const { site_name } = useSite();
  return (
    <InfoPage title="Affiliate disclosure" updated={UPDATED} description={`How ${site_name} earns money from store links, and why it never costs you more.`}>
      <p>{site_name} is free to use. To keep it that way, many of the links on our site are affiliate links.</p>

      <h2>What that means</h2>
      <p>When you click a link to a store and make a purchase, the store, or the affiliate network it works with, may pay us a small commission. The commission comes from the store's marketing budget.</p>

      <h2>It never costs you more</h2>
      <p>Using our links doesn't change the price you pay. Often you'll pay less, because you'll be using a code or deal from our site.</p>

      <h2>How it affects what we list</h2>
      <p>Commission doesn't decide which offers appear on {site_name}. We list an offer because it's useful to shoppers, whether or not it earns us anything. Some stores on the site don't pay us at all.</p>

      <h2>Questions</h2>
      <p>If you'd like to know more about how we work, reach us through <SupportLink />.</p>
    </InfoPage>
  );
}
