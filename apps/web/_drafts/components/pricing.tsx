import { Check } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

const includes = [
  "Custom business logic development",
  "Stripe subscription/payment integration",
  "User authentication & authorization",
  "Admin dashboard (basic)",
  "Full source code ownership",
]

const faqs = [
  {
    question: "What if I need more complex features?",
    answer: "We'll discuss your requirements during the estimate call and provide a custom quote based on scope.",
  },
  {
    question: "Do I own the code?",
    answer: "Yes, 100%. You get full source code ownership and can host it anywhere you want.",
  },
  {
    question: "What's the payment structure?",
    answer: "50% upfront to start, 50% on delivery. No hidden fees or surprise costs.",
  },
  {
    question: "Can you help with hosting?",
    answer: "I'll set up your deployment on Vercel or your preferred platform as part of the package.",
  },
]

export function Pricing() {
  return (
    <section className="py-24 border-t border-border">
      <div className="container mx-auto px-6">
        <div className="max-w-2xl">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
            Predictable Pricing. Zero Hidden Fees.
          </h2>
        </div>

        <div className="mt-12 grid lg:grid-cols-2 gap-8 lg:gap-12 items-start">
          {/* Pricing Card */}
          <Card className="border-2 border-foreground bg-card">
            <CardHeader className="pb-4">
              <CardDescription className="text-base text-foreground font-medium">
                MVP Launch Package
              </CardDescription>
              <CardTitle className="text-4xl font-bold mt-2">
                Starting at $1,500
              </CardTitle>
              <p className="text-muted-foreground mt-2">4 weeks delivery</p>
            </CardHeader>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground uppercase tracking-wide font-medium mb-4">
                What's included
              </p>
              <ul className="space-y-3">
                {includes.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <Check className="size-5 text-foreground flex-shrink-0 mt-0.5" />
                    <span className="text-foreground">{item}</span>
                  </li>
                ))}
              </ul>
              <Button className="w-full mt-8" size="lg">
                Request a Technical Estimate
              </Button>
            </CardContent>
          </Card>

          {/* FAQ */}
          <div>
            <h3 className="text-lg font-semibold mb-6">Frequently Asked Questions</h3>
            <div className="space-y-6">
              {faqs.map((faq) => (
                <div key={faq.question}>
                  <h4 className="font-medium text-foreground">{faq.question}</h4>
                  <p className="mt-2 text-muted-foreground leading-relaxed max-w-md">
                    {faq.answer}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
