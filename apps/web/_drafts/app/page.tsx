import { Header } from "@/components/header"
import { Hero } from "@/components/hero"
import { ProblemSolution } from "@/components/problem-solution"
import { Dogfooding } from "@/components/dogfooding"
import { Portfolio } from "@/components/portfolio"
import { Workflow } from "@/components/workflow"
import { Pricing } from "@/components/pricing"
import { FooterCTA } from "@/components/footer-cta"
import { Footer } from "@/components/footer"

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header />
      <main>
        <Hero />
        <div id="problem">
          <ProblemSolution />
        </div>
        <Dogfooding />
        <div id="portfolio">
          <Portfolio />
        </div>
        <div id="workflow">
          <Workflow />
        </div>
        <div id="pricing">
          <Pricing />
        </div>
        <FooterCTA />
      </main>
      <Footer />
    </div>
  )
}
