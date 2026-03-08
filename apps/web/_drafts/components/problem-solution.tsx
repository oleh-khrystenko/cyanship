import { Layers, Code2, Rocket } from "lucide-react"

const features = [
  {
    icon: Layers,
    title: "Clean Architecture",
    description: "Strict boundaries between the core features and your custom logic.",
  },
  {
    icon: Code2,
    title: "Fully Typed",
    description: "Built with TypeScript, Next.js, and NestJS for predictability and fewer bugs.",
  },
  {
    icon: Rocket,
    title: "Ready to Scale",
    description: "MongoDB database and Stripe payments integrated out of the box.",
  },
]

export function ProblemSolution() {
  return (
    <section className="py-24 border-t border-border">
      <div className="container mx-auto px-6">
        <div className="max-w-2xl">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
            Skip the Boilerplate. Focus on Business.
          </h2>
          <div className="mt-8 space-y-4 text-muted-foreground text-lg leading-relaxed max-w-xl">
            <p>
              Most startup budgets are burned on rebuilding authentication, database models, and payment integrations. I've already built that.
            </p>
            <p>
              Using my proprietary modular core, "LucidShip", we skip the repetitive setup.
            </p>
            <p>
              I strip out my agency module, keep the rock-solid foundation, and start building your unique business logic on day one.
            </p>
          </div>
        </div>

        <div className="mt-16 grid md:grid-cols-3 gap-8">
          {features.map((feature) => (
            <div 
              key={feature.title} 
              className="p-6 rounded-lg border border-border bg-card"
            >
              <feature.icon className="size-8 text-foreground" />
              <h3 className="mt-4 text-lg font-semibold">{feature.title}</h3>
              <p className="mt-2 text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
