import { Footer } from '@/components/ui/footer-section';

export default function FooterDemo() {
	return (
		<div className="relative flex min-h-screen flex-col">
			<div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
				<div className="text-center space-y-4">
					<h1 className="font-mono text-4xl font-bold text-gray-800 dark:text-white">
						HealthConnect Platform
					</h1>
					<p className="text-lg text-gray-600 dark:text-gray-300">
						Scroll down to see the footer!
					</p>
					<div className="animate-bounce mt-8">
						<svg className="w-6 h-6 mx-auto text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
						</svg>
					</div>
				</div>
			</div>
			<Footer />
		</div>
	);
}