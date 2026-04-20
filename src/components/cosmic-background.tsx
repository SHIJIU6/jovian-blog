'use client'

import { useEffect, useRef } from 'react'

interface Star {
	x: number
	y: number
	z: number
	size: number
	opacity: number
	twinkleSpeed: number
	twinklePhase: number
	vx: number
	vy: number
}

interface ShootingStar {
	x: number
	y: number
	vx: number
	vy: number
	length: number
	opacity: number
	life: number
}

interface Planet {
	x: number
	y: number
	size: number
	color: string
	glowColor: string
	orbitRadius: number
	orbitSpeed: number
	angle: number
	rings?: boolean
}

interface Constellation {
	stars: { x: number; y: number; size: number }[]
	connections: [number, number][]
	color: string
}

interface Particle {
	x: number
	y: number
	vx: number
	vy: number
	size: number
	opacity: number
	color: string
}

export function CosmicBackground() {
	const canvasRef = useRef<HTMLCanvasElement>(null)

	useEffect(() => {
		const canvas = canvasRef.current
		if (!canvas) return

		const ctx = canvas.getContext('2d', { alpha: false })
		if (!ctx) return

		let width = window.innerWidth
		let height = window.innerHeight

		// 多层星空系统
		const stars: Star[] = []
		const starCount = 600
		const shootingStars: ShootingStar[] = []
		const particles: Particle[] = []
		let constellations: Constellation[] = []
		let planets: Planet[] = []

		function initStars() {
			stars.length = 0
			for (let i = 0; i < starCount; i++) {
				stars.push({
					x: Math.random() * width,
					y: Math.random() * height,
					z: Math.random() * 3,
					size: Math.random() * 2.5 + 0.3,
					opacity: Math.random() * 0.7 + 0.3,
					twinkleSpeed: Math.random() * 0.015 + 0.003,
					twinklePhase: Math.random() * Math.PI * 2,
					vx: (Math.random() - 0.5) * 0.05,
					vy: (Math.random() - 0.5) * 0.05
				})
			}
		}

		function initPlanets() {
			planets = [
				{
					x: width * 0.12,
					y: height * 0.18,
					size: 70,
					color: '#ffffff',
					glowColor: '#ffffff',
					orbitRadius: 35,
					orbitSpeed: 0.0003,
					angle: 0,
					rings: true
				},
				{
					x: width * 0.88,
					y: height * 0.75,
					size: 55,
					color: '#cccccc',
					glowColor: '#ffffff',
					orbitRadius: 25,
					orbitSpeed: 0.0005,
					angle: Math.PI
				},
				{
					x: width * 0.75,
					y: height * 0.25,
					size: 40,
					color: '#dddddd',
					glowColor: '#ffffff',
					orbitRadius: 18,
					orbitSpeed: 0.0007,
					angle: Math.PI / 2
				},
				{
					x: width * 0.25,
					y: height * 0.82,
					size: 48,
					color: '#e8e8e8',
					glowColor: '#ffffff',
					orbitRadius: 22,
					orbitSpeed: 0.0004,
					angle: Math.PI * 1.5
				}
			]
		}

		function initConstellations() {
			constellations = [
				// 巨蟹座 (Cancer) - 倒Y字形
				{
					stars: [
						{ x: width * 0.15, y: height * 0.3, size: 2.8 },
						{ x: width * 0.18, y: height * 0.28, size: 3 },
						{ x: width * 0.21, y: height * 0.26, size: 2.5 },
						{ x: width * 0.19, y: height * 0.32, size: 3.2 },
						{ x: width * 0.22, y: height * 0.35, size: 2.6 },
						{ x: width * 0.16, y: height * 0.34, size: 2.8 }
					],
					connections: [[0, 1], [1, 2], [1, 3], [3, 4], [3, 5]],
					color: 'rgba(255, 255, 255, 0.3)'
				},
				// 双鱼座 (Pisces) - 两条鱼连接
				{
					stars: [
						{ x: width * 0.7, y: height * 0.2, size: 2.5 },
						{ x: width * 0.73, y: height * 0.18, size: 2.8 },
						{ x: width * 0.76, y: height * 0.2, size: 2.6 },
						{ x: width * 0.73, y: height * 0.23, size: 3 },
						{ x: width * 0.78, y: height * 0.28, size: 2.7 },
						{ x: width * 0.81, y: height * 0.26, size: 2.5 },
						{ x: width * 0.84, y: height * 0.28, size: 2.8 }
					],
					connections: [[0, 1], [1, 2], [2, 3], [3, 0], [3, 4], [4, 5], [5, 6]],
					color: 'rgba(255, 255, 255, 0.28)'
				},
				// 金牛座 (Taurus) - V字形
				{
					stars: [
						{ x: width * 0.28, y: height * 0.65, size: 3.2 },
						{ x: width * 0.31, y: height * 0.62, size: 2.8 },
						{ x: width * 0.34, y: height * 0.6, size: 3 },
						{ x: width * 0.37, y: height * 0.62, size: 2.6 },
						{ x: width * 0.4, y: height * 0.65, size: 2.9 },
						{ x: width * 0.34, y: height * 0.67, size: 2.5 }
					],
					connections: [[0, 1], [1, 2], [2, 3], [3, 4], [2, 5]],
					color: 'rgba(255, 255, 255, 0.32)'
				},
				// 白羊座 (Aries) - 简单的弧形
				{
					stars: [
						{ x: width * 0.55, y: height * 0.75, size: 2.6 },
						{ x: width * 0.58, y: height * 0.73, size: 3 },
						{ x: width * 0.61, y: height * 0.75, size: 2.8 },
						{ x: width * 0.64, y: height * 0.78, size: 2.5 }
					],
					connections: [[0, 1], [1, 2], [2, 3]],
					color: 'rgba(255, 255, 255, 0.3)'
				},
				// 天蝎座 (Scorpio) - S形曲线
				{
					stars: [
						{ x: width * 0.82, y: height * 0.45, size: 2.8 },
						{ x: width * 0.85, y: height * 0.48, size: 3 },
						{ x: width * 0.88, y: height * 0.52, size: 2.6 },
						{ x: width * 0.86, y: height * 0.56, size: 2.9 },
						{ x: width * 0.83, y: height * 0.59, size: 2.5 },
						{ x: width * 0.85, y: height * 0.62, size: 2.7 }
					],
					connections: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5]],
					color: 'rgba(255, 255, 255, 0.28)'
				},
				// 狮子座 (Leo) - 镰刀形
				{
					stars: [
						{ x: width * 0.45, y: height * 0.15, size: 3 },
						{ x: width * 0.48, y: height * 0.13, size: 2.8 },
						{ x: width * 0.51, y: height * 0.15, size: 3.2 },
						{ x: width * 0.53, y: height * 0.18, size: 2.6 },
						{ x: width * 0.5, y: height * 0.2, size: 2.9 },
						{ x: width * 0.47, y: height * 0.18, size: 2.5 }
					],
					connections: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0]],
					color: 'rgba(255, 255, 255, 0.3)'
				},
				// 处女座 (Virgo) - Y字形
				{
					stars: [
						{ x: width * 0.08, y: height * 0.55, size: 2.7 },
						{ x: width * 0.11, y: height * 0.52, size: 3 },
						{ x: width * 0.14, y: height * 0.5, size: 2.5 },
						{ x: width * 0.11, y: height * 0.48, size: 2.8 },
						{ x: width * 0.08, y: height * 0.46, size: 2.6 }
					],
					connections: [[0, 1], [1, 2], [1, 3], [3, 4]],
					color: 'rgba(255, 255, 255, 0.27)'
				},
				// 射手座 (Sagittarius) - 箭形
				{
					stars: [
						{ x: width * 0.62, y: height * 0.4, size: 2.5 },
						{ x: width * 0.65, y: height * 0.38, size: 2.8 },
						{ x: width * 0.68, y: height * 0.36, size: 3 },
						{ x: width * 0.66, y: height * 0.42, size: 2.6 },
						{ x: width * 0.63, y: height * 0.44, size: 2.7 }
					],
					connections: [[0, 1], [1, 2], [1, 3], [3, 4]],
					color: 'rgba(255, 255, 255, 0.29)'
				},
				// 水瓶座 (Aquarius) - 波浪形
				{
					stars: [
						{ x: width * 0.35, y: height * 0.82, size: 2.6 },
						{ x: width * 0.38, y: height * 0.8, size: 2.8 },
						{ x: width * 0.41, y: height * 0.82, size: 2.5 },
						{ x: width * 0.44, y: height * 0.8, size: 2.9 },
						{ x: width * 0.47, y: height * 0.82, size: 2.6 }
					],
					connections: [[0, 1], [1, 2], [2, 3], [3, 4]],
					color: 'rgba(255, 255, 255, 0.28)'
				},
				// 摩羯座 (Capricorn) - 三角形
				{
					stars: [
						{ x: width * 0.9, y: height * 0.7, size: 2.8 },
						{ x: width * 0.93, y: height * 0.68, size: 2.6 },
						{ x: width * 0.96, y: height * 0.7, size: 2.9 },
						{ x: width * 0.93, y: height * 0.73, size: 2.5 }
					],
					connections: [[0, 1], [1, 2], [2, 3], [3, 0]],
					color: 'rgba(255, 255, 255, 0.3)'
				},
				// 天秤座 (Libra) - 平衡形
				{
					stars: [
						{ x: width * 0.05, y: height * 0.75, size: 2.7 },
						{ x: width * 0.08, y: height * 0.73, size: 2.9 },
						{ x: width * 0.11, y: height * 0.75, size: 2.6 },
						{ x: width * 0.08, y: height * 0.78, size: 3 }
					],
					connections: [[0, 1], [1, 2], [1, 3]],
					color: 'rgba(255, 255, 255, 0.28)'
				},
				// 双子座 (Gemini) - 双线平行
				{
					stars: [
						{ x: width * 0.92, y: height * 0.15, size: 2.8 },
						{ x: width * 0.95, y: height * 0.13, size: 2.6 },
						{ x: width * 0.92, y: height * 0.2, size: 2.7 },
						{ x: width * 0.95, y: height * 0.18, size: 2.9 }
					],
					connections: [[0, 1], [2, 3], [0, 2]],
					color: 'rgba(255, 255, 255, 0.29)'
				}
			]
		}

		const resizeCanvas = () => {
			width = window.innerWidth
			height = window.innerHeight
			canvas.width = width
			canvas.height = height
			initStars()
			initConstellations()
			initPlanets()
		}
		resizeCanvas()
		window.addEventListener('resize', resizeCanvas)

		// 创建流星
		function createShootingStar() {
			if (Math.random() < 0.015) {
				shootingStars.push({
					x: Math.random() * width,
					y: Math.random() * height * 0.5,
					vx: Math.random() * 8 + 4,
					vy: Math.random() * 6 + 3,
					length: Math.random() * 80 + 40,
					opacity: 1,
					life: 1
				})
			}
		}

		// 创建粒子
		function createParticles(x: number, y: number, color: string) {
			for (let i = 0; i < 8; i++) {
				particles.push({
					x,
					y,
					vx: (Math.random() - 0.5) * 2,
					vy: (Math.random() - 0.5) * 2,
					size: Math.random() * 2 + 1,
					opacity: 1,
					color
				})
			}
		}

		let animationId: number
		let time = 0

		const animate = () => {
			// 纯黑背景
			ctx.fillStyle = '#000000'
			ctx.fillRect(0, 0, width, height)

			time += 1

			// 绘制深空渐变效果
			const bgGradient = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.max(width, height))
			bgGradient.addColorStop(0, 'rgba(20, 20, 20, 0.2)')
			bgGradient.addColorStop(0.5, 'rgba(10, 10, 10, 0.15)')
			bgGradient.addColorStop(1, 'rgba(0, 0, 0, 0.1)')
			ctx.fillStyle = bgGradient
			ctx.fillRect(0, 0, width, height)

			// 绘制多层星空
			stars.forEach(star => {
				star.x += star.vx * (1 + star.z)
				star.y += star.vy * (1 + star.z)

				if (star.x < 0) star.x = width
				if (star.x > width) star.x = 0
				if (star.y < 0) star.y = height
				if (star.y > height) star.y = 0

				star.twinklePhase += star.twinkleSpeed
				const twinkle = Math.sin(star.twinklePhase) * 0.4 + 0.6
				const layerOpacity = star.opacity * twinkle * (0.4 + star.z * 0.3)

				// 星星本体
				ctx.fillStyle = `rgba(255, 255, 255, ${layerOpacity})`
				ctx.beginPath()
				ctx.arc(star.x, star.y, star.size * (1 + star.z * 0.3), 0, Math.PI * 2)
				ctx.fill()

				// 星星光晕
				const glowSize = star.size * (2 + star.z)
				const gradient = ctx.createRadialGradient(star.x, star.y, 0, star.x, star.y, glowSize)
				gradient.addColorStop(0, `rgba(255, 255, 255, ${layerOpacity * 0.4})`)
				gradient.addColorStop(0.5, `rgba(200, 220, 255, ${layerOpacity * 0.2})`)
				gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')
				ctx.fillStyle = gradient
				ctx.beginPath()
				ctx.arc(star.x, star.y, glowSize, 0, Math.PI * 2)
				ctx.fill()
			})

			// 绘制星座
			constellations.forEach(constellation => {
				// 星座连线
				ctx.strokeStyle = constellation.color
				ctx.lineWidth = 1.5
				ctx.shadowBlur = 8
				ctx.shadowColor = constellation.color
				constellation.connections.forEach(([start, end]) => {
					const startStar = constellation.stars[start]
					const endStar = constellation.stars[end]
					ctx.beginPath()
					ctx.moveTo(startStar.x, startStar.y)
					ctx.lineTo(endStar.x, endStar.y)
					ctx.stroke()
				})
				ctx.shadowBlur = 0

				// 星座星星
				constellation.stars.forEach(star => {
					const gradient = ctx.createRadialGradient(star.x, star.y, 0, star.x, star.y, star.size * 2)
					gradient.addColorStop(0, constellation.color.replace('0.4', '1'))
					gradient.addColorStop(0.4, constellation.color.replace('0.4', '0.8'))
					gradient.addColorStop(1, constellation.color.replace('0.4', '0'))
					ctx.fillStyle = gradient
					ctx.beginPath()
					ctx.arc(star.x, star.y, star.size * 2, 0, Math.PI * 2)
					ctx.fill()

					// 星星核心
					ctx.fillStyle = '#ffffff'
					ctx.beginPath()
					ctx.arc(star.x, star.y, star.size * 0.6, 0, Math.PI * 2)
					ctx.fill()
				})
			})

			// 绘制星球
			planets.forEach(planet => {
				planet.angle += planet.orbitSpeed
				const offsetX = Math.cos(planet.angle) * planet.orbitRadius
				const offsetY = Math.sin(planet.angle) * planet.orbitRadius
				const px = planet.x + offsetX
				const py = planet.y + offsetY

				// 星球外层微弱光晕
				const outerGlow = ctx.createRadialGradient(px, py, planet.size * 0.8, px, py, planet.size * 1.5)
				outerGlow.addColorStop(0, 'rgba(255, 255, 255, 0.05)')
				outerGlow.addColorStop(1, 'rgba(255, 255, 255, 0)')
				ctx.fillStyle = outerGlow
				ctx.beginPath()
				ctx.arc(px, py, planet.size * 1.5, 0, Math.PI * 2)
				ctx.fill()

				// 星球轮廓线
				ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)'
				ctx.lineWidth = 2
				ctx.shadowBlur = 8
				ctx.shadowColor = 'rgba(255, 255, 255, 0.4)'
				ctx.beginPath()
				ctx.arc(px, py, planet.size, 0, Math.PI * 2)
				ctx.stroke()
				ctx.shadowBlur = 0

				// 星球内部细节线条（增加层次感）
				ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'
				ctx.lineWidth = 1
				ctx.beginPath()
				ctx.arc(px, py, planet.size * 0.7, 0, Math.PI * 2)
				ctx.stroke()

				ctx.beginPath()
				ctx.arc(px, py, planet.size * 0.4, 0, Math.PI * 2)
				ctx.stroke()

				// 星环（只有轮廓）
				if (planet.rings) {
					ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)'
					ctx.lineWidth = 2
					ctx.shadowBlur = 6
					ctx.shadowColor = 'rgba(255, 255, 255, 0.3)'
					ctx.beginPath()
					ctx.ellipse(px, py, planet.size * 1.6, planet.size * 0.4, Math.PI * 0.2, 0, Math.PI * 2)
					ctx.stroke()

					// 内环
					ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)'
					ctx.lineWidth = 1
					ctx.beginPath()
					ctx.ellipse(px, py, planet.size * 1.4, planet.size * 0.35, Math.PI * 0.2, 0, Math.PI * 2)
					ctx.stroke()
					ctx.shadowBlur = 0
				}

				// 随机产生粒子
				if (Math.random() < 0.02) {
					createParticles(px, py, 'rgba(255, 255, 255')
				}
			})

			// 绘制粒子
			particles.forEach((particle, index) => {
				particle.x += particle.vx
				particle.y += particle.vy
				particle.opacity -= 0.015
				particle.size *= 0.98

				if (particle.opacity <= 0) {
					particles.splice(index, 1)
					return
				}

				ctx.fillStyle = particle.color.replace(')', `, ${particle.opacity})`)
				ctx.beginPath()
				ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2)
				ctx.fill()
			})

			// 创建流星
			createShootingStar()

			// 绘制流星
			shootingStars.forEach((star, index) => {
				star.x += star.vx
				star.y += star.vy
				star.life -= 0.01
				star.opacity = star.life

				if (star.life <= 0) {
					shootingStars.splice(index, 1)
					return
				}

				const gradient = ctx.createLinearGradient(star.x, star.y, star.x - star.vx * 10, star.y - star.vy * 10)
				gradient.addColorStop(0, `rgba(255, 255, 255, ${star.opacity})`)
				gradient.addColorStop(0.5, `rgba(200, 220, 255, ${star.opacity * 0.6})`)
				gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')

				ctx.strokeStyle = gradient
				ctx.lineWidth = 2
				ctx.shadowBlur = 15
				ctx.shadowColor = 'rgba(255, 255, 255, 0.8)'
				ctx.beginPath()
				ctx.moveTo(star.x, star.y)
				ctx.lineTo(star.x - star.vx * 10, star.y - star.vy * 10)
				ctx.stroke()
				ctx.shadowBlur = 0
			})

			animationId = requestAnimationFrame(animate)
		}

		animate()

		return () => {
			window.removeEventListener('resize', resizeCanvas)
			cancelAnimationFrame(animationId)
		}
	}, [])

	return (
		<canvas
			ref={canvasRef}
			className="fixed inset-0 z-0 pointer-events-none"
			style={{ background: '#000000' }}
		/>
	)
}
