import { MessageSquare, Video, GitBranch } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

const workflowSteps = [
  {
    icon: MessageSquare,
    title: "Async Communication",
    description: "Slack and email for structured, searchable decisions.",
  },
  {
    icon: Video,
    title: "Video Updates",
    description: "Detailed Loom screen recordings showcasing new features and UI/UX flows.",
  },
  {
    icon: GitBranch,
    title: "Code Transparency",
    description: "Regular repository pushes. You always own your IP.",
  },
]

export function Workflow() {
  return (
    <section className="py-24 border-t border-border">
      <div className="container mx-auto px-6">
        <div className="max-w-2xl">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
            No Useless Meetings. Just Daily Progress.
          </h2>
          <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
            I value your time. My workflow is designed for founders who prefer tangible results over endless Zoom calls.
          </p>
        </div>

        <div className="mt-16 grid md:grid-cols-3 gap-6">
          {workflowSteps.map((step) => (
            <Card key={step.title} className="bg-card border-border">
              <CardContent className="pt-6">
                <div className="size-12 rounded-lg border border-border bg-secondary flex items-center justify-center">
                  <step.icon className="size-6 text-foreground" />
                </div>
                <h3 className="mt-5 text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 text-muted-foreground leading-relaxed max-w-sm">
                  {step.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
