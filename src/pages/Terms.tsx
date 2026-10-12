import { LegalPage, CONTACT_EMAIL, CONTACT_PHONE } from "@/components/legal/LegalPage";

export default function Terms() {
  return (
    <LegalPage
      title="Terms of Service"
      updated="10 October 2026"
      intro={
        <p>
          These terms govern your use of kanokaftan.shop and the Kano Kaftan app ("Kano Kaftan", "we", "us"). By creating an
          account or placing an order you agree to them. If you do not agree, please do not use the service.
        </p>
      }
      sections={[
        {
          heading: "The marketplace",
          body: (
            <p>
              Kano Kaftan is a marketplace. Most items are listed and made by independent sellers ("vendors"), who are responsible
              for their listings, quality and sizing. We provide the platform, payment protection on orders paid through Kano
              Kaftan, customer support and delivery coordination.
            </p>
          ),
        },
        {
          heading: "Accounts",
          body: (
            <ul>
              <li>You must be at least 18, give accurate information and keep your login secure.</li>
              <li>You are responsible for activity on your account. Tell us straight away if you suspect misuse.</li>
              <li>We may suspend accounts that break these terms, commit fraud or abuse other users.</li>
            </ul>
          ),
        },
        {
          heading: "Buying on Kano Kaftan",
          body: (
            <>
              <p>You can buy in two ways:</p>
              <ul>
                <li>
                  <strong>Through Kano Kaftan (protected).</strong> You pay us through Paystack, either at checkout or after
                  arranging an order with our support team. We hold the payment, arrange delivery and only pay the seller in full
                  once you confirm delivery (for example by giving the rider your delivery code), or automatically after the
                  delivery window ends if no dispute is raised.
                </li>
                <li>
                  <strong>Directly with a seller (at your own risk).</strong> If you chat with a seller and pay or meet them outside
                  Kano Kaftan, that deal is between you and the seller. We cannot protect, refund or mediate payments made outside
                  the platform.
                </li>
              </ul>
              <p>Prices are in Nigerian Naira and include the item price; delivery fees are shown before you pay.</p>
            </>
          ),
        },
        {
          heading: "Delivery, problems and refunds",
          body: (
            <ul>
              <li>Check your order when it arrives. Only confirm delivery or share your delivery code once you have the item.</li>
              <li>If an item does not arrive, is significantly different from its description, or is damaged, open a dispute from the order page before confirming delivery. We will review it with the seller and may refund you in full or in part.</li>
              <li>Approved refunds go back to the original payment method through Paystack.</li>
            </ul>
          ),
        },
        {
          heading: "Selling on Kano Kaftan",
          body: (
            <ul>
              <li>Sellers must list only items they have the right to sell, describe them honestly, and ship on time.</li>
              <li>Orders customers place and pay for in the app: the seller receives their full item price and Kano Kaftan keeps the delivery fee paid by the customer.</li>
              <li>Orders Kano Kaftan arranges for a customer through its chat: Kano Kaftan keeps a commission (shown in your seller dashboard) plus the delivery fee.</li>
              <li>Deals a seller closes privately with a customer outside Kano Kaftan checkout carry no Kano Kaftan fees, and are not covered by Kano Kaftan buyer protection or delivery.</li>
              <li>Payouts are sent to your verified bank account through Paystack: part when the order is paid and the rest after delivery is confirmed or the delivery window ends.</li>
              <li>We may hold payouts while a dispute is open and may deduct refunds owed to customers.</li>
              <li>Sellers are responsible for their own taxes.</li>
            </ul>
          ),
        },
        {
          heading: "Seller verification and featured placement",
          body: (
            <ul>
              <li><strong>Verification:</strong> sellers may pay a verification fee and submit identity and business details. Payment does not guarantee approval. If we ask for changes, you can resubmit without paying again. If we cannot verify you, contact us about a refund. We may remove a verified badge if a seller breaks these terms.</li>
              <li><strong>Featured placement:</strong> verified sellers may pay to feature a product or their shop on the homepage for a set number of weeks. Placement starts once payment is confirmed and ends automatically. Fees for placements that have started are not refundable. We may remove promoted content that breaks these terms, without refund.</li>
              <li>Fees and durations are shown before you pay and may change for future purchases.</li>
            </ul>
          ),
        },
        {
          heading: "Things you must not do",
          body: (
            <ul>
              <li>Sell counterfeit, stolen or illegal items, or items you do not have.</li>
              <li>Mislead buyers, post fake reviews, or harass other users.</li>
              <li>Try to get around payment protection to defraud buyers or sellers.</li>
              <li>Interfere with the site, scrape it, or access other people's accounts.</li>
            </ul>
          ),
        },
        {
          heading: "Content",
          body: (
            <p>
              You keep ownership of photos, descriptions and messages you post, and give us permission to display them on Kano
              Kaftan and in our marketing of your listings. Do not upload content you do not have the right to use. The Kano Kaftan
              name and logo belong to us.
            </p>
          ),
        },
        {
          heading: "Liability",
          body: (
            <p>
              We work hard to keep Kano Kaftan running and safe, but the service is provided "as is". To the extent the law allows,
              we are not liable for indirect losses, or for deals made outside the platform. Our total liability for any claim
              relating to an order is limited to the amount you paid through Kano Kaftan for that order. Nothing in these terms
              limits rights you have under Nigerian consumer protection law.
            </p>
          ),
        },
        {
          heading: "Changes and termination",
          body: (
            <p>
              We may update these terms; we will change the date above and tell you about important changes. You can stop using
              the service at any time. We may suspend or close accounts that break these terms.
            </p>
          ),
        },
        {
          heading: "Governing law",
          body: <p>These terms are governed by the laws of the Federal Republic of Nigeria. Disputes will be handled by the courts of Kano State, unless the law says otherwise.</p>,
        },
        {
          heading: "Contact",
          body: (
            <p>
              Email: <span className="select-all font-medium text-foreground">{CONTACT_EMAIL}</span>. Phone/WhatsApp:{" "}
              <span className="select-all font-medium text-foreground">{CONTACT_PHONE}</span>.
            </p>
          ),
        },
      ]}
    />
  );
}
