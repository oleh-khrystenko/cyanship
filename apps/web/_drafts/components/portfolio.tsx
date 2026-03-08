import { Play } from "lucide-react"

export function Portfolio() {
  return (
    <section className="py-24 border-t border-border">
      <div className="container mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Text Block - Left */}
          <div>
            <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Portfolio
            </span>
            <h2 className="mt-4 text-3xl md:text-4xl font-bold tracking-tight">
              Product Thinking Over Just Coding
            </h2>
            <div className="mt-6 space-y-4 text-lg text-muted-foreground leading-relaxed max-w-lg">
              <p>
                I respect client NDAs and never share proprietary code.
              </p>
              <p>
                To see how I handle UI/UX, user flows, and complex business logic, check out Wish Hub — my independent SaaS project. While built on an earlier architectural iteration, it showcases my ability to deliver complete, user-centric products from scratch.
              </p>
            </div>
          </div>

          {/* Video Block - Right */}
          <div className="aspect-video rounded-lg border border-border bg-card flex items-center justify-center cursor-pointer hover:bg-secondary transition-colors">
            <div className="flex flex-col items-center gap-4">
              <div className="size-16 rounded-full bg-foreground flex items-center justify-center">
                <Play className="size-6 text-background ml-1" />
              </div>
              <span className="text-muted-foreground text-sm">Watch Loom Video</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
