
if ( ! Detector.webgl ) Detector.addGetWebGLMessage();

function isMobileDevice() {
    return (typeof window.orientation !== "undefined") || (navigator.userAgent.indexOf('IEMobile') !== -1);
};

var container, stats;
var camera, scene, renderer, light, ship, island;
var controls, water, sphere;
var raycaster;

var objects = [];

var controlsEnabled = false;

var moveForward = false;
var moveBackward = false;
var moveLeft = false;
var moveRight = false;
var canJump = false;

var prevTime = performance.now();
var clock = new THREE.Clock();
var velocity = new THREE.Vector3();
var direction = new THREE.Vector3();
var vertex = new THREE.Vector3();
var color = new THREE.Color();

init();
animate();

function init() {

	container = document.getElementById( 'container' );

	//

	renderer = new THREE.WebGLRenderer();
	renderer.setPixelRatio( window.devicePixelRatio );
	renderer.setSize( window.innerWidth, window.innerHeight );
	container.appendChild( renderer.domElement );

	//

	scene = new THREE.Scene();

	//

	camera = new THREE.PerspectiveCamera( 55, window.innerWidth / window.innerHeight, 1, 20000 )
	;
	camera.position.set( 0, 20, 20 );

	if(isMobileDevice()){
		console.log('is mobile');
		controls = new THREE.DeviceOrientationControls( camera );
	} else {

		console.log('fly controls');
		controls = new THREE.FirstPersonControls(camera);
        controls.lookSpeed = 0.4;
        controls.movementSpeed = 20;
        controls.noFly = true;
        controls.lookVertical = true;
        controls.constrainVertical = true;
        controls.verticalMin = 1.0;
        controls.verticalMax = 2.0;
        controls.lon = -150;
        controls.lat = 120;
	}

	//
	raycaster = new THREE.Raycaster( new THREE.Vector3(), new THREE.Vector3( 0, - 1, 0 ), 0, 10 );


	light = new THREE.HemisphereLight( 0xffffff, 0xffffff, 0.6 );
	light.color.setHSL( 0.6, 1, 0.6 );
	light.groundColor.setHSL( 0.095, 1, 0.75 );
	light.position.set( 0, 50, 0 );
	scene.add( light );

	// texture

	var manager = new THREE.LoadingManager();
	manager.onProgress = function ( item, loaded, total ) {

		console.log( item, loaded, total );

	};

	var textureLoader = new THREE.TextureLoader( manager );
	var texture = textureLoader.load( 'textures/UV_Grid_Sm.jpg' );
	var textureFlare0 = textureLoader.load( 'textures/lensflare/lensflare0.png' );
	var textureFlare3 = textureLoader.load( 'textures/lensflare/lensflare3.png' );

	var lensflare = new THREE.Lensflare();
	lensflare.addElement( new THREE.LensflareElement( textureFlare0, 700, 0, light.color ) );
	lensflare.addElement( new THREE.LensflareElement( textureFlare3, 120, 0.6 ) );
	lensflare.addElement( new THREE.LensflareElement( textureFlare3, 200, 0.7 ) );
	lensflare.addElement( new THREE.LensflareElement( textureFlare3, 320, 0.9 ) );
	lensflare.addElement( new THREE.LensflareElement( textureFlare3, 70, 1 ) );
	light.add( lensflare );

	// model

	var onProgress = function ( xhr ) {
		if ( xhr.lengthComputable ) {
			var percentComplete = xhr.loaded / xhr.total * 100;
			console.log( Math.round(percentComplete, 2) + '% downloaded' );
		}
	};

	var onError = function ( xhr ) {
	};

	THREE.Loader.Handlers.add( /\.dds$/i, new THREE.DDSLoader() );
	new THREE.MTLLoader()
		.setPath( 'models/obj/' )
		.load( 'ship/ship.mtl', function ( materials ) {
			materials.preload();
			new THREE.OBJLoader()
				.setMaterials( materials )
				.setPath( 'models/obj/ship/' )
				.load( 'ship.obj', function ( object ) {
					ship = object;
					object.position.y = -2;
					object.position.x = 70;
					object.rotation.y = 10;
					object.position.z = -150;
					object.scale.x = 0.2;
					object.scale.y = 0.2;
					object.scale.z = 0.2;
					scene.add( object );
				}, onProgress, onError );
		})
	// Water

	var waterGeometry = new THREE.PlaneBufferGeometry( 10000, 10000 );

	water = new THREE.Water(
		waterGeometry,
		{
			textureWidth: 512,
			textureHeight: 512,
			waterNormals: new THREE.TextureLoader().load( 'textures/waternormals.jpg', function ( texture ) {
				texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
			}),
			alpha: 1.0,
			sunDirection: light.position.clone().normalize(),
			sunColor: 0xffffff,
			waterColor: 0x001e0f,
			distortionScale:  3.7,
			fog: scene.fog !== undefined
		}
	);

	water.rotation.x = - Math.PI / 2;

	scene.add( water );

	// Skybox

	var sky = new THREE.Sky();
	sky.scale.setScalar( 10000 );
	scene.add( sky );

	var uniforms = sky.material.uniforms;

	uniforms.turbidity.value = 10;
	uniforms.rayleigh.value = 2;
	uniforms.luminance.value = 1;
	uniforms.mieCoefficient.value = 0.005;
	uniforms.mieDirectionalG.value = 0.8;

	var parameters = {
		distance: 400,
		inclination: 0.5,
		azimuth: 0.205
	};

	var cubeCamera = new THREE.CubeCamera( 1, 20000, 256 );
	cubeCamera.renderTarget.texture.minFilter = THREE.LinearMipMapLinearFilter;

	function updateSun() {

		var theta = Math.PI * ( parameters.inclination - 0.5 );
		var phi = 2 * Math.PI * ( parameters.azimuth - 0.5 );

		light.position.x = parameters.distance * Math.cos( phi );
		light.position.y = parameters.distance * Math.sin( phi ) * Math.sin( theta );
		light.position.z = parameters.distance * Math.sin( phi ) * Math.cos( theta );

		sky.material.uniforms.sunPosition.value = light.position.copy( light.position );
		water.material.uniforms.sunDirection.value.copy( light.position ).normalize();

		cubeCamera.update( renderer, scene );

	}

	updateSun();

	var material = new THREE.MeshStandardMaterial( {
		vertexColors: THREE.VertexColors,
		roughness: 0.0,
		flatShading: true,
		envMap: cubeCamera.renderTarget.texture,
		side: THREE.DoubleSide
	} );

	//

	camera.target = new THREE.Vector3( 0, 0, 0 );

	var uniforms = water.material.uniforms;

	window.addEventListener( 'resize', onWindowResize, false );

}

function onWindowResize() {

	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();

	renderer.setSize( window.innerWidth, window.innerHeight );

}

function animate(e) {
	var timer = Date.now();
	if(ship){
		ship.position.y = Math.cos( timer / 1000 );
		ship.rotation.z = Math.sin( timer / 1600 ) / 8;
		ship.rotation.x = Math.sin( timer / 1700 ) / 40;
	}

	
	if(isMobileDevice()){
		controls.update();
	}

	requestAnimationFrame( animate );
	render();

}

function render() {

	var delta = clock.getDelta();

	if(!isMobileDevice()){
		controls.update( delta );
	}

	var time = performance.now() * 0.001;

	water.material.uniforms.time.value += 1.0 / 60.0;

	renderer.render( scene, camera );

}