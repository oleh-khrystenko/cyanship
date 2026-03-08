export function Footer() {
  return (
    <footer className="py-8 border-t border-border">
      <div className="container mx-auto px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold tracking-tight">LucidShip</span>
          </div>
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} LucidShip. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
