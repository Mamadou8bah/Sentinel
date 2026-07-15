import CinematicCta from '../components/landing/CinematicCta'
import Features from '../components/landing/Features'
import Footer from '../components/landing/Footer'
import Hero from '../components/landing/Hero'
import HowItWorks from '../components/landing/HowItWorks'
import Impact from '../components/landing/Impact'
import Navbar from '../components/landing/Navbar'
import Testimonials from '../components/landing/Testimonials'

export default function LandingPage() {
  return (
    <main className="bg-ink text-white">
      <Navbar />
      <Hero />
      <Features />
      <Impact />
      <HowItWorks />
      <Testimonials />
      <CinematicCta />
      <Footer />
    </main>
  )
}
