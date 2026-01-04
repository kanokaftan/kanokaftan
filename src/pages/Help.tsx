import { useState } from "react";
import { HelpCircle, Mail, Phone, MessageCircle, ChevronDown } from "lucide-react";
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
    answer: "To become a vendor, sign up with the 'Vendor' role option. You'll get access to the vendor dashboard where you can list products and manage orders."
  },
  {
    question: "Is my payment secure?",
    answer: "Absolutely! All payments are processed securely through Paystack, and your payment information is encrypted."
  },
];

export default function Help() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <MobileLayout>
      <div className="container max-w-2xl py-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Help & Support</h1>
          <p className="text-muted-foreground">Find answers or get in touch</p>
        </div>

        {/* Contact Options */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Mail className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-medium">Email Us</h3>
                  <p className="text-sm text-muted-foreground">support@oja.ng</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Phone className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-medium">Call Us</h3>
                  <p className="text-sm text-muted-foreground">+234 800 123 4567</p>
                </div>
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
          <CardContent className="space-y-2">
            {faqs.map((faq, index) => (
              <Collapsible
                key={index}
                open={openFaq === index}
                onOpenChange={() => setOpenFaq(openFaq === index ? null : index)}
              >
                <CollapsibleTrigger asChild>
                  <Button
                    variant="ghost"
                    className="w-full justify-between font-normal h-auto py-3 px-4"
                  >
                    <span className="text-left">{faq.question}</span>
                    <ChevronDown 
                      className={`h-4 w-4 transition-transform ${openFaq === index ? 'rotate-180' : ''}`} 
                    />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="px-4 pb-3">
                  <p className="text-sm text-muted-foreground">{faq.answer}</p>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </CardContent>
        </Card>

        {/* Chat Support */}
        <Card className="bg-primary text-primary-foreground">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-primary-foreground/20 flex items-center justify-center">
                <MessageCircle className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <h3 className="font-medium">Need more help?</h3>
                <p className="text-sm opacity-80">Our support team is available 9am - 6pm</p>
              </div>
              <Button variant="secondary" size="sm">
                Chat Now
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </MobileLayout>
  );
}
