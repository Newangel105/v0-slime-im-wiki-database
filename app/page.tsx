import { Card } from "@/components/ui/card"
import { Play, ExternalLink } from "lucide-react"
import HomeTimersClient from "@/components/home-timers-client"
import HomeYouTubeClient from "@/components/home-youtube-client"
import HomeNewsClient from "@/components/home-news-client"

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-[#0a1a2f] via-[#0f1f35] to-[#1a2740]">
      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* About Section */}
        <section className="mb-8">
          <Card className="bg-[#181f2a]/80 border border-gray-700/50 backdrop-blur-sm overflow-hidden">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                <span className="h-1 w-8 bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full"></span>
                ABOUT
              </h2>
              <p className="text-gray-300 leading-relaxed mb-4">
                Welcome to <span className="text-cyan-400 font-semibold">SLIME.WIKI</span> - The comprehensive database for 
                <span className="text-blue-400 font-medium"> SLIME - Isekai Memories</span>, the official That Time I Got Reincarnated as a Slime 
                mobile game developed by WFS and published by Bandai Namco Entertainment.
              </p>
              <div className="flex flex-wrap gap-4 text-xs text-gray-500 pt-4 border-t border-gray-700/50">
                <span>Database maintained by the community</span>
                <span className="text-gray-600">|</span>
                <span>All game assets and content are property of WFS and Bandai Namco Entertainment</span>
                <span className="text-gray-600">|</span>
                <span>This is an unofficial fan-made resource</span>
              </div>
            </div>
          </Card>
        </section>

        {/* Main Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Timers Section - Left Column (client widget) */}
          <section className="lg:col-span-2">
            <HomeTimersClient />
          </section>

          {/* Latest Stream Section - Right Column (client widget) */}
          <section className="lg:col-span-1">
            <HomeYouTubeClient />
          </section>
        </div>

        {/* News Section - Full Width (client widget) */}
        <section>
          <HomeNewsClient />
        </section>

        {/* Footer */}
        <footer className="mt-12 pt-6 border-t border-gray-700/30 text-center">
          <p className="text-gray-500 text-sm">
            SLIME.WIKI is a fan-made database. All rights reserved to WFS and Bandai Namco Entertainment.
          </p>
          <p className="text-gray-600 text-xs mt-2">
            That Time I Got Reincarnated as a Slime is a trademark of the respective owners.
          </p>
        </footer>
      </div>
    </main>
  )
}
