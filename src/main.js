import './style.css';
import * as Matter from 'matter-js';
import MatterAttractors from 'matter-attractors';

// Main game code
(() => {
	// plugins
	Matter.use(MatterAttractors);

	// constants
	const PATHS = {
		//DOME: '0 0 0 100 50 100 100 90 150 70 200 50 250 40 300 50 350 70 400 90 450 100 500 100 500 0 0 0',
		DOME: '0 0 0 100 125 70 250 50 375 70 500 100 500 0 0 0',
		DROP_LEFT: '0 0 20 0 70 100 20 150 0 150 0 0',
		DROP_RIGHT: '50 0 68 0 68 150 50 150 0 100 50 0',
		APRON_LEFT: '0 0 180 120 0 120 0 0',
		APRON_RIGHT: '180 0 180 120 0 120 180 0'
	};
	const COLOR = {
		BACKGROUND: '#212529',
		OUTER: '#495057',
		INNER: '#15aabf',
		BUMPER: '#fab005',
		BUMPER_LIT: '#fff3bf',
		PADDLE: '#e64980',
		PINBALL: '#dee2e6'
	};
	const GRAVITY = 0.75;
	const WIREFRAMES = false;
	const BUMPER_BOUNCE = 1.5;
	const PADDLE_PULL = 0.002;
	const MAX_VELOCITY = 50;

	// score elements
	let $currentScore = document.querySelector('.current-score span');
	let $highScore = document.querySelector('.high-score span');

	// shared variables
	let currentScore, highScore;
	let engine, world, render, pinball, stopperGroup;
	let leftPaddle, leftUpStopper, leftDownStopper, isLeftPaddleUp;
	let rightPaddle, rightUpStopper, rightDownStopper, isRightPaddleUp;

	function load() {
		init();
		createStaticBodies();
		createPaddles();
		createPinball();
		createEvents();
	}

	function init() {
		// engine (shared)
		engine = Matter.Engine.create();

		// world (shared)
		world = engine.world;
		world.bounds = {
			min: { x: 0, y: 0 },
			max: { x: 500, y: 800 }
		};
		world.gravity.y = GRAVITY; // simulate rolling on a slanted table

		// render (shared)
		render = Matter.Render.create({
			element: document.querySelector('.container'),
			engine: engine,
			options: {
				width: world.bounds.max.x,
				height: world.bounds.max.y,
				wireframes: WIREFRAMES,
				background: COLOR.BACKGROUND
			}
		});
		Matter.Render.run(render);

		// runner
		let runner = Matter.Runner.create();
		Matter.Runner.run(runner, engine);

		// used for collision filtering on various bodies
		stopperGroup = Matter.Body.nextGroup(true);

		// starting values
		currentScore = 0;
		highScore = 0;
		isLeftPaddleUp = false;
		isRightPaddleUp = false;
	}

	function createStaticBodies() {
		Matter.World.add(world, [
			// table boundaries (top, bottom, left, right)
			boundary(250, -30, 500, 100),
			boundary(250, 830, 500, 100),
			boundary(-30, 400, 100, 800),
			boundary(530, 400, 100, 800),

			// dome
			//path(239, 86, PATHS.DOME),
			path(250, 0, PATHS.DOME),

			// pegs (left, mid, right)
			wall(140, 140, 20, 40, COLOR.INNER),
			wall(225, 140, 20, 40, COLOR.INNER),
			wall(310, 140, 20, 40, COLOR.INNER),

			// top bumpers (left, mid, right)
			bumper(105, 250),
			bumper(225, 250),
			bumper(345, 250),

			// bottom bumpers (left, right)
			bumper(165, 340),
			bumper(285, 340),

			// shooter lane wall
			wall(440, 520, 20, 560, COLOR.OUTER),

			// drops (left, right)
			path(25, 360, PATHS.DROP_LEFT),
			path(425, 360, PATHS.DROP_RIGHT),

			// slingshots (left, right)
			wall(120, 510, 20, 120, COLOR.INNER),
			wall(330, 510, 20, 120, COLOR.INNER),

			// out lane walls (left, right)
			wall(60, 529, 20, 160, COLOR.INNER),
			wall(390, 529, 20, 160, COLOR.INNER),

			// flipper walls (left, right);
			wall(93, 624, 20, 98, COLOR.INNER, -0.96),
			wall(357, 624, 20, 98, COLOR.INNER, 0.96),

			// aprons (left, right)
			path(79, 740, PATHS.APRON_LEFT),
			path(371, 740, PATHS.APRON_RIGHT),

			// reset zones (center, right)
			reset(225, 50),
			reset(465, 30)
		]);
	}

	function createPaddles() {
		// these bodies keep paddle swings contained, but allow the ball to pass through
		leftUpStopper = stopper(160, 591, 'left', 'up');
		leftDownStopper = stopper(140, 743, 'left', 'down');
		rightUpStopper = stopper(290, 591, 'right', 'up');
		rightDownStopper = stopper(310, 743, 'right', 'down');
		Matter.World.add(world, [leftUpStopper, leftDownStopper, rightUpStopper, rightDownStopper]);

		// this group lets paddle pieces overlap each other
		let paddleGroup = Matter.Body.nextGroup(true);

		// Left paddle mechanism
		let paddleLeft = {};
		paddleLeft.paddle = Matter.Bodies.trapezoid(170, 660, 20, 80, 0.33, {
			label: 'paddleLeft',
			angle: 1.57,
			chamfer: {},
			render: {
				fillStyle: COLOR.PADDLE
			}
		});
		paddleLeft.brick = Matter.Bodies.rectangle(172, 672, 40, 80, {
			angle: 1.62,
			chamfer: {},
			render: {
				visible: false
			}
		});
		paddleLeft.comp = Matter.Body.create({
			label: 'paddleLeftComp',
			parts: [paddleLeft.paddle, paddleLeft.brick]
		});
		paddleLeft.hinge = Matter.Bodies.circle(142, 660, 5, {
			isStatic: true,
			render: {
				visible: false
			}
		});
		Object.values(paddleLeft).forEach((piece) => {
			piece.collisionFilter.group = paddleGroup
		});
		paddleLeft.con = Matter.Constraint.create({
			bodyA: paddleLeft.comp,
			pointA: { x: -29.5, y: -8.5 },
			bodyB: paddleLeft.hinge,
			length: 0,
			stiffness: 0
		});
		Matter.World.add(world, [paddleLeft.comp, paddleLeft.hinge, paddleLeft.con]);
		Matter.Body.rotate(paddleLeft.comp, 0.57, { x: 142, y: 660 });

		// right paddle mechanism
		let paddleRight = {};
		paddleRight.paddle = Matter.Bodies.trapezoid(280, 660, 20, 80, 0.33, {
			label: 'paddleRight',
			angle: -1.57,
			chamfer: {},
			render: {
				fillStyle: COLOR.PADDLE
			}
		});
		paddleRight.brick = Matter.Bodies.rectangle(278, 672, 40, 80, {
			angle: -1.62,
			chamfer: {},
			render: {
				visible: false
			}
		});
		paddleRight.comp = Matter.Body.create({
			label: 'paddleRightComp',
			parts: [paddleRight.paddle, paddleRight.brick]
		});
		paddleRight.hinge = Matter.Bodies.circle(308, 660, 5, {
			isStatic: true,
			render: {
				visible: false
			}
		});
		Object.values(paddleRight).forEach((piece) => {
			piece.collisionFilter.group = paddleGroup
		});
		paddleRight.con = Matter.Constraint.create({
			bodyA: paddleRight.comp,
			pointA: { x: 29.5, y: -8.5 },
			bodyB: paddleRight.hinge,
			length: 0,
			stiffness: 0
		});
		Matter.World.add(world, [paddleRight.comp, paddleRight.hinge, paddleRight.con]);
		Matter.Body.rotate(paddleRight.comp, -0.57, { x: 308, y: 660 });
	}

	function createPinball() {
		// x/y are set to when pinball is launched
		pinball = Matter.Bodies.circle(0, 0, 14, {
			label: 'pinball',
			collisionFilter: {
				group: stopperGroup
			},
			render: {
				fillStyle: COLOR.PINBALL
			}
		});
		Matter.World.add(world, pinball);
		launchPinball();
	}

	function createEvents() {
		// events for when the pinball hits stuff
		Matter.Events.on(engine, 'collisionStart', function (event) {
			let pairs = event.pairs;
			pairs.forEach(function (pair) {
				if (pair.bodyB.label === 'pinball') {
					switch (pair.bodyA.label) {
						case 'reset':
							launchPinball();
							break;
						case 'bumper':
							pingBumper(pair.bodyA);
							break;
					}
				}
			});
		});

		// regulate pinball
		Matter.Events.on(engine, 'beforeUpdate', function (event) {
			// bumpers can quickly multiply velocity, so keep that in check
			Matter.Body.setVelocity(pinball, {
				x: Math.max(Math.min(pinball.velocity.x, MAX_VELOCITY), -MAX_VELOCITY),
				y: Math.max(Math.min(pinball.velocity.y, MAX_VELOCITY), -MAX_VELOCITY),
			});

			// cheap way to keep ball from going back down the shooter lane
			if (pinball.position.x > 450 && pinball.velocity.y > 0) {
				Matter.Body.setVelocity(pinball, { x: 0, y: -10 });
			}

			// Debug - Sichtbarkeit des Pinballs sicherstellen
			if (!pinball.isVisible && pinball.position.y > 790) {
				console.log("Pinball außerhalb des sichtbaren Bereichs - Neustart");
				launchPinball();
			}

			// Paddle-Bewegung verfolgen
			if (isLeftPaddleUp) {
				console.log("Linkes Paddle aktiviert");
			}
			if (isRightPaddleUp) {
				console.log("Rechtes Paddle aktiviert");
			}
		});

		// mouse drag (god mode for grabbing pinball)
		Matter.World.add(world, Matter.MouseConstraint.create(engine, {
			mouse: Matter.Mouse.create(render.canvas),
			constraint: {
				stiffness: 0.2,
				render: {
					visible: false
				}
			}
		}));

		// keyboard paddle events
		document.body.addEventListener('keydown', function (e) {
			if (e.key === 'ArrowLeft' || e.which === 37) { // left arrow key
				isLeftPaddleUp = true;
				console.log("Linke Taste gedrückt");
			} else if (e.key === 'ArrowRight' || e.which === 39) { // right arrow key
				isRightPaddleUp = true;
				console.log("Rechte Taste gedrückt");
			}
		});
		document.body.addEventListener('keyup', function (e) {
			if (e.key === 'ArrowLeft' || e.which === 37) { // left arrow key
				isLeftPaddleUp = false;
			} else if (e.key === 'ArrowRight' || e.which === 39) { // right arrow key
				isRightPaddleUp = false;
			}
		});

		// click/tap paddle events
		const leftTrigger = document.querySelector('.left-trigger');
		const rightTrigger = document.querySelector('.right-trigger');

		const startEvents = ['mousedown', 'touchstart'];
		const endEvents = ['mouseup', 'touchend'];

		startEvents.forEach(event => {
			leftTrigger.addEventListener(event, function () {
				isLeftPaddleUp = true;
				console.log("Linker Button gedrückt");
			});

			rightTrigger.addEventListener(event, function () {
				isRightPaddleUp = true;
				console.log("Rechter Button gedrückt");
			});
		});

		endEvents.forEach(event => {
			leftTrigger.addEventListener(event, function () {
				isLeftPaddleUp = false;
			});

			rightTrigger.addEventListener(event, function () {
				isRightPaddleUp = false;
			});
		});

		// Debug-Button zum Neustart des Pinballs
		document.addEventListener('keydown', function (e) {
			if (e.key === 'r' || e.key === 'R') {
				console.log("Pinball neu starten");
				launchPinball();
			}
		});
	}

	function launchPinball() {
		updateScore(0);
		Matter.Body.setPosition(pinball, { x: 465, y: 765 });
		Matter.Body.setVelocity(pinball, { x: 0, y: -25 + rand(-2, 2) });
		Matter.Body.setAngularVelocity(pinball, 0);
	}

	function pingBumper(bumper) {
		updateScore(currentScore + 10);

		// flash color
		bumper.render.fillStyle = COLOR.BUMPER_LIT;
		setTimeout(function () {
			bumper.render.fillStyle = COLOR.BUMPER;
		}, 100);
	}

	function updateScore(newCurrentScore) {
		currentScore = newCurrentScore;
		$currentScore.textContent = currentScore;

		highScore = Math.max(currentScore, highScore);
		$highScore.textContent = highScore;
	}

	// matter.js has a built in random range function, but it is deterministic
	function rand(min, max) {
		return Math.random() * (max - min) + min;
	}

	// outer edges of pinball table
	function boundary(x, y, width, height) {
		return Matter.Bodies.rectangle(x, y, width, height, {
			isStatic: true,
			render: {
				fillStyle: COLOR.OUTER
			}
		});
	}

	// wall segments
	function wall(x, y, width, height, color, angle = 0) {
		return Matter.Bodies.rectangle(x, y, width, height, {
			angle: angle,
			isStatic: true,
			chamfer: { radius: 10 },
			render: {
				fillStyle: color
			}
		});
	}

	// bodies created from SVG paths
	function path(x, y, path) {
		let vertices = Matter.Vertices.fromPath(path);
		return Matter.Bodies.fromVertices(x, y, vertices, {
			isStatic: true,
			render: {
				fillStyle: COLOR.OUTER,

				// add stroke and line width to fill in slight gaps between fragments
				strokeStyle: COLOR.OUTER,
				lineWidth: 1
			}
		});
	}

	// round bodies that repel pinball
	function bumper(x, y) {
		let bumper = Matter.Bodies.circle(x, y, 25, {
			label: 'bumper',
			isStatic: true,
			render: {
				fillStyle: COLOR.BUMPER
			}
		});

		// for some reason, restitution is reset unless it's set after body creation
		bumper.restitution = BUMPER_BOUNCE;

		return bumper;
	}

	// invisible bodies to constrict paddles
	function stopper(x, y, side, position) {
		// determine which paddle composite to interact with
		let attracteeLabel = (side === 'left') ? 'paddleLeftComp' : 'paddleRightComp';

		return Matter.Bodies.circle(x, y, 40, {
			isStatic: true,
			render: {
				visible: false,
			},
			collisionFilter: {
				group: stopperGroup
			},
			plugin: {
				attractors: [
					// stopper is always a, other body is b
					function (a, b) {
						if (b.label === attracteeLabel) {
							let isPaddleUp = (side === 'left') ? isLeftPaddleUp : isRightPaddleUp;
							let isPullingUp = (position === 'up' && isPaddleUp);
							let isPullingDown = (position === 'down' && !isPaddleUp);
							if (isPullingUp || isPullingDown) {
								return {
									x: (a.position.x - b.position.x) * PADDLE_PULL,
									y: (a.position.y - b.position.y) * PADDLE_PULL,
								};
							}
						}
					}
				]
			}
		});
	}

	// contact with these bodies causes pinball to be relaunched
	function reset(x, width) {
		return Matter.Bodies.rectangle(x, 781, width, 2, {
			label: 'reset',
			isStatic: true,
			render: {
				fillStyle: '#fff'
			}
		});
	}

	// Start the game when DOM is loaded
	document.addEventListener('DOMContentLoaded', load);
})();
