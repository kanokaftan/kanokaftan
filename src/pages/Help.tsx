import { useState } from "react";
import { HelpCircle, Mail, Phone, MessageCircle, ChevronDown, Send, ExternalLink } from "lucide-react";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const faqs = [
  {
    question: "How do I track my order?",
    answer: "You can track your order by going to 'Orders' in the menu. Click on any order to see its current status and tracking updates."
  },
  {
    question: "What payment methods are accepted?",
    answer: "We accept all major Nigerian bank cards, bank transfers, and USSD payments through Paystack."
  },
  {
    question: "How long does delivery take?",
    answer: "Delivery typically takes 2-5 business days within Lagos, and 5-10 business days for other states."
  },
  {
    question: "Can I return or exchange an item?",
    answer: "Yes, you can request a return or exchange within 7 days of delivery. The item must be unused and in its original packaging. Contact us to initiate a return."
  },
  {
    question: "How do I become a vendor?",
    answer: "Go to your Account page and click 'Become a Vendor' to upgrade your account. You'll get access to the vendor dashboard where you can list products and manage orders."
  },
  {
    question: "Is my payment secure?",
    answer: "Absolutely! All payments are processed securely through Paystack, and your payment information is encrypted. We also hold payments in escrow until you confirm delivery."
  },
  {
    question: "How does shipping work?",
    answer: "Shipping is calculated based on the distance between the vendor and your delivery address. Use promo code FREESHIP26 for free shipping!"
  },
  {
    question: "Can I cancel my order?",
    answer: "You can cancel orders that have not been paid for. Go to your Orders page and click 'Cancel Order' on pending payment orders."
  },
];

export default function Help() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const handleWhatsApp = () => {
    window.open("https://wa.me/2349076944503?text=Hello%2C%20I%20need%20help%20with%20my%20order", "_blank");
  };

  const handleCall = () => {
    window.open("tel:+2349076944503", "_self");
  };

  const handleEmail = () => {
    window.open("mailto:kanokaftan@gmail.com?subject=Support%20Request", "_self");
  };

  return (
    <MobileLayout>
      <div className="container max-w-2xl py-6 space-y-6 pb-24">
        <div>
          <h1 className="text-2xl font-bold">Help & Support</h1>
          <p className="text-muted-foreground">Find answers or get in touch with us</p>
        </div>

        {/* Contact Options */}
        <div className="grid gap-3">
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={handleEmail}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Mail className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium">Email Us</h3>
                  <p className="text-sm text-muted-foreground truncate">kanokaftan@gmail.com</p>
                </div>
                <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              </div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={handleCall}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-green-500/10 flex items-center justify-center flex-shrink-0">
                  <Phone className="h-5 w-5 text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium">Call Us</h3>
                  <p className="text-sm text-muted-foreground">+234 907 694 4503</p>
                </div>
                <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              </div>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:shadow-md transition-shadow bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800" onClick={handleWhatsApp}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                  <MessageCircle className="h-5 w-5 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium">Chat on WhatsApp</h3>
                  <p className="text-sm text-muted-foreground">Get instant support</p>
                </div>
                <Button size="sm" className="bg-green-600 hover:bg-green-700 gap-1">
                  <Send className="h-3 w-3" />
                  Chat
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* FAQ Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5" />
              Frequently Asked Questions
            </CardTitle>
            <CardDescription>
              Quick answers to common questions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            {faqs.map((faq, index) => (
              <Collapsible
                key={index}
                open={openFaq === index}
                onOpenChange={() => setOpenFaq(openFaq === index ? null : index)}
              >
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-full justify-between font-normal h-auto py-3 px-3 text-left"
                  >
                    <span className="text-sm pr-2">{faq.question}</span>
                    <ChevronDown 
                      className={`h-4 w-4 flex-shrink-0 transition-transform ${openFaq === index ? 'rotate-180' : ''}`} 
                    />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="px-3 pb-3">
                  <p className="text-sm text-muted-foreground leading-relaxed">{faq.answer}</p>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </CardContent>
        </Card>

        {/* Business Hours */}
        <Card>
          <CardContent className="pt-6">
            <div className="text-center space-y-2">
              <h3 className="font-medium">Business Hours</h3>
              <p className="text-sm text-muted-foreground">
                Monday - Saturday: 9:00 AM - 6:00 PM (WAT)
              </p>
              <p className="text-sm text-muted-foreground">
                Sunday: Closed
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </MobileLayout>
  );
}
