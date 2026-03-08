import { Check } from "lucide-react"

const steps = [
  "Create an account to test the auth flow.",
  "Click the Stripe checkout to see the payment integration.",
  "Experience the load speed firsthand.",
]

export function Dogfooding() {
  return (
    <section className="py-24 border-t border-border">
      <div className="container mx-auto px-6">
        <div className="max-w-2xl">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
            You Are Looking at the Code Right Now
          </h2>
          <p className="mt-6 text-lg text-muted-foreground leading-relaxed max-w-xl">
            I don't just sell this architecture; I run my business on it. This landing page is built on the exact same LucidShip core your product will use.
          </p>
        </div>

        <div className="mt-12 max-w-xl">
          <ul className="space-y-4">
            {steps.map((step, index) => (
              <li 
                key={index} 
                className="flex items-start gap-4 p-4 rounded-lg border border-border bg-card"
              >
                <div className="flex-shrink-0 size-6 rounded-full bg-foreground flex items-center justify-center">
                  <Check className="size-4 text-background" />
                </div>
                <span className="text-foreground">{step}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
