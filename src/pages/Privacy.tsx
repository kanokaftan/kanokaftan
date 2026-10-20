import { LegalPage, CONTACT_EMAIL, CONTACT_PHONE } from "@/components/legal/LegalPage";

export default function Privacy() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated="10 October 2026"
      intro={
        <>
          <p>
            Kano Kaftan ("we", "us") runs kanokaftan.shop, a marketplace for traditional Nigerian attire where customers buy
            from independent sellers. This policy explains what personal data we collect, why, who we share it with, and the
            choices you have. We process personal data in line with the Nigeria Data Protection Act 2023.
          </p>
        </>
      }
      sections={[
        {
          heading: "Information we collect",
          body: (
            <ul>
              <li><strong>Account details:</strong> your name, email address, phone number and profile photo. If you sign in with Google, we receive your name, email address and profile picture from Google. We do not receive your Google password.</li>
              <li><strong>Orders and delivery:</strong> delivery addresses, items you buy, order history, and the delivery code used to confirm receipt.</li>
              <li><strong>Payments:</strong> payments are processed by Paystack. We receive the payment status, amount and reference. We never see or store your full card details.</li>
              <li><strong>Messages:</strong> chats with our support team and with sellers, including photos and voice notes you send.</li>
              <li><strong>Seller information:</strong> shop name, logo, address, product listings, and bank account details for payouts (verified and stored through Paystack). Sellers who apply for verification also give us a business address, phone number, ID type and number, and a copy of an ID document.</li>
              <li><strong>Usage data:</strong> basic technical data such as device type, pages visited and items you have viewed, used to keep the site working and improve it.</li>
            </ul>
          ),
        },
        {
          heading: "How we use your information",
          body: (
            <ul>
              <li>To create and secure your account and let you sign in, including with Google.</li>
              <li>To process orders, take payment, arrange delivery, hold payment in escrow and pay sellers.</li>
              <li>To provide customer support and let you chat with sellers.</li>
              <li>To verify sellers and prevent fraud.</li>
              <li>To send notifications about your orders, messages and account.</li>
              <li>To meet legal, tax and accounting obligations.</li>
            </ul>
          ),
        },
        {
          heading: "Who we share it with",
          body: (
            <>
              <p>We do not sell your personal data. We share it only as needed to run the service:</p>
              <ul>
                <li><strong>Sellers</strong> receive what they need to fulfil your order (for example your name and delivery address).</li>
                <li><strong>Delivery partners</strong> receive your name, phone number and delivery address.</li>
                <li><strong>Paystack</strong> processes payments and seller payouts.</li>
                <li><strong>Supabase</strong> hosts our database, sign-in and file storage. <strong>Vercel</strong> hosts the website.</li>
                <li><strong>Google</strong>, if you choose to sign in with Google.</li>
                <li>Authorities, when the law requires it.</li>
              </ul>
              <p>Some of these providers store data outside Nigeria. We use providers that protect personal data to recognised standards.</p>
            </>
          ),
        },
        {
          heading: "Google user data",
          body: (
            <p>
              When you sign in with Google we only request your basic profile (name, email address and profile picture). We use it
              to create and sign in to your Kano Kaftan account and to show your name and photo in the app. We do not use
              Google user data for advertising and do not share it with anyone except as described in this policy.
            </p>
          ),
        },
        {
          heading: "How long we keep it",
          body: (
            <p>
              We keep account data while your account is open. Order and payment records are kept for as long as tax and
              accounting rules require (usually up to 6 years). Seller ID documents are kept while the seller is active and
              deleted within 12 months after the shop closes, unless we need them to resolve a dispute or meet a legal duty.
            </p>
          ),
        },
        {
          heading: "Your rights",
          body: (
            <>
              <p>
                You can ask to see, correct, download or delete your personal data, object to some uses, or withdraw consent.
                You can update most details in your account settings. For anything else, contact us at the email below and we will
                respond within 30 days. You may also complain to the Nigeria Data Protection Commission.
              </p>
              <p>
                To delete your account, open Account settings and tap "Delete my account" (see{" "}
                <a href="/delete-account" className="underline">kanokaftan.shop/delete-account</a>), or email us from the address on
                your account. We will delete or anonymise your data, except records we must keep by law.
              </p>
            </>
          ),
        },
        {
          heading: "Security",
          body: (
            <p>
              We use encrypted connections, access controls so people only see their own data, private storage for ID documents
              and chat media, and payment processing through Paystack. No system is perfectly secure, so please keep your password
              private and tell us if you notice anything suspicious.
            </p>
          ),
        },
        {
          heading: "Children",
          body: <p>Kano Kaftan is not intended for children under 18, and we do not knowingly collect their data.</p>,
        },
        {
          heading: "Changes to this policy",
          body: <p>We may update this policy. We will change the date above and, for important changes, notify you in the app or by email.</p>,
        },
        {
          heading: "Contact us",
          body: (
            <p>
              Kano Kaftan, Kano, Nigeria. Email: <span className="select-all font-medium text-foreground">{CONTACT_EMAIL}</span>.
              Phone/WhatsApp: <span className="select-all font-medium text-foreground">{CONTACT_PHONE}</span>.
            </p>
          ),
        },
      ]}
    />
  );
}
