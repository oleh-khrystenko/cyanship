import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"

export function Hero() {
  return (
    <section className="py-24 md:py-32">
      <div className="container mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left: Content */}
          <div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-balance">
              Launch Your SaaS MVP in 4 Weeks.
            </h1>
            <p className="mt-6 text-lg md:text-xl text-muted-foreground leading-relaxed max-w-xl">
              I build production-ready B2B platforms using a battle-tested Next.js & NestJS core. Fast time-to-market. Zero agency overhead.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-4">
              <Button size="lg" className="text-base px-8 h-12 font-semibold">
                Request a Technical Estimate
                <ArrowRight className="ml-2 size-4" />
              </Button>
              <Button variant="ghost" size="lg" className="text-base h-12 text-muted-foreground hover:text-foreground">
                Try Live Demo
              </Button>
            </div>
          </div>

          {/* Right: Code Visual */}
          <div className="relative">
            <div className="border border-border rounded-lg bg-card overflow-hidden">
              {/* Window chrome */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-secondary/50">
                <div className="flex gap-1.5">
                  <div className="size-3 rounded-full bg-muted-foreground/30" />
                  <div className="size-3 rounded-full bg-muted-foreground/30" />
                  <div className="size-3 rounded-full bg-muted-foreground/30" />
                </div>
                <span className="text-xs text-muted-foreground font-mono ml-2">api/subscriptions/route.ts</span>
              </div>
              {/* Code content */}
              <div className="p-6 font-mono text-sm leading-relaxed">
                <div className="text-muted-foreground">{"// Your MVP's payment logic"}</div>
                <div className="mt-2">
                  <span className="text-muted-foreground">export async function</span>{" "}
                  <span className="text-foreground">POST</span>
                  <span className="text-muted-foreground">(req: Request) {"{"}</span>
                </div>
                <div className="pl-4 mt-1">
                  <span className="text-muted-foreground">const</span>{" "}
                  <span className="text-foreground">session</span>{" "}
                  <span className="text-muted-foreground">=</span>{" "}
                  <span className="text-muted-foreground">await</span>{" "}
                  <span className="text-foreground">stripe</span>
                  <span className="text-muted-foreground">.checkout.sessions.</span>
                  <span className="text-foreground">create</span>
                  <span className="text-muted-foreground">({"{"}</span>
                </div>
                <div className="pl-8 text-muted-foreground">
                  mode: <span className="text-foreground">'subscription'</span>,
                </div>
                <div className="pl-8 text-muted-foreground">
                  customer: <span className="text-foreground">user.stripeCustomerId</span>,
                </div>
                <div className="pl-8 text-muted-foreground">
                  line_items: <span className="text-foreground">[...]</span>,
                </div>
                <div className="pl-4 text-muted-foreground">{"});"}</div>
                <div className="mt-2 text-muted-foreground">{"}"}</div>
              </div>
            </div>
            {/* Decorative glow */}
            <div className="absolute -inset-px rounded-lg bg-gradient-to-b from-foreground/5 to-transparent pointer-events-none" />
          </div>
        </div>
      </div>
    </section>
  )
}
