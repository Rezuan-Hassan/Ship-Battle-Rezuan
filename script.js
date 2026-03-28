const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = 800; canvas.height = 400;

const ship1 = new Image(); ship1.src = 'ship1.png';
const ship2 = new Image(); ship2.src = 'ship2.png';

// 1. PEER SETUP (Using public cloud)
const peer = new Peer(); 
let conn = null;
let isHost = false;
let money = 0, round = 1;

// ID Generation
peer.on('open', (id) => {
    document.getElementById('my-id').innerText = "ID: " + id;
    console.log("My Peer ID: " + id);
});

// ERROR LOGGING (Crucial for CSE Debugging)
peer.on('error', (err) => {
    console.error(err);
    alert("Connection Error: " + err.type + ". Check if the ID is correct!");
});

// HOST RECEIVES CONNECTION
peer.on('connection', (connection) => {
    conn = connection;
    isHost = true;
    setupData();
    document.getElementById('lobby').style.display = 'none';
    update();
});

// GUEST SENDS CONNECTION
function connectToFriend() {
    const friendID = document.getElementById('friend-id').value.trim();
    if (!friendID) return alert("Please paste an ID!");
    
    conn = peer.connect(friendID);
    isHost = false;

    conn.on('open', () => {
        setupData();
        document.getElementById('lobby').style.display = 'none';
        update();
    });
}

function setupData() {
    conn.on('data', (d) => {
        if (isHost) {
            if (d.type === 'move') p2.x = Math.max(0, Math.min(700, p2.x + d.dx));
            if (d.type === 'fire') bullets.push({ x: p2.x + 50, y: p2.y, vy: -7 });
        } else {
            p1 = d.p1; p2 = d.p2; bullets = d.bullets;
            money = d.m; round = d.r;
        }
    });
}

// 2. GAME STATE
let p1 = { x: 350, y: 50, shields: 6, health: 100 };
let p2 = { x: 350, y: 270, shields: 6, health: 100 };
let bullets = [];
let moveDir = 0;

function update() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    if (isHost && conn && conn.open) {
        p1.x = Math.max(0, Math.min(700, p1.x + moveDir));
        bullets.forEach((b, i) => {
            b.y += b.vy;
            if (b.vy < 0 && b.y < p1.y + 80 && b.x > p1.x && b.x < p1.x + 100) {
                bullets.splice(i, 1); p1.shields > 0 ? p1.shields-- : p1.health -= 10;
            }
            if (b.vy > 0 && b.y > p2.y && b.x > p2.x && b.x < p2.x + 100) {
                bullets.splice(i, 1); p2.shields > 0 ? (p2.shields--, money += 25) : p2.health -= 10;
            }
        });
        if (p1.health <= 0 || p2.health <= 0) { round++; p1.health=100; p2.health=100; p1.shields=6; p2.shields=6; }
        conn.send({ p1, p2, bullets, m: money, r: round });
    } else if (conn && conn.open && !isHost && moveDir !== 0) {
        conn.send({ type: 'move', dx: moveDir });
    }

    // Drawing
    ctx.save(); ctx.translate(p1.x+50, p1.y+40); ctx.rotate(Math.PI); ctx.drawImage(ship1, -50, -40, 100, 80); ctx.restore();
    ctx.drawImage(ship2, p2.x, p2.y, 100, 80);
    ctx.fillStyle = 'yellow'; bullets.forEach(b => ctx.fillRect(b.x, b.y, 4, 12));
    
    document.getElementById('money-display').innerText = money;
    document.getElementById('round-display').innerText = round;
    requestAnimationFrame(update);
}

// 3. INPUTS
const handleMove = (dir) => moveDir = dir;
document.getElementById('left-btn').ontouchstart = (e) => { e.preventDefault(); handleMove(-6); };
document.getElementById('right-btn').ontouchstart = (e) => { e.preventDefault(); handleMove(6); };
document.getElementById('left-btn').ontouchend = () => handleMove(0);
document.getElementById('right-btn').ontouchend = () => handleMove(0);

document.getElementById('fire-btn').ontouchstart = (e) => {
    e.preventDefault();
    if (!conn || !conn.open) return;
    if (isHost) bullets.push({ x: p1.x + 50, y: p1.y + 80, vy: 7 });
    else conn.send({ type: 'fire' });
};
