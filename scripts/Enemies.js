runOnStartup(async runtime => {
    const CONFIG = {
        skeleton: {
            patrolSpeed: 1,
            chaseSpeed: 1.2,
            detectionRange: 150,
            attackRange: 50,
            patrolWidth: 200,
            attackCooldown: 1000,
            deathAnimationTime: 60,
            health: 3
        },
        evilEye: {
            floatSpeed: 0.05,
            floatAmplitude: 20,
            chaseSpeed: 1,
            detectionRange: 200,
            health: 1
        }
    };

    const enemyState = new Map();

    runtime.addEventListener('tick', () => {
        const wolf = runtime.objects.Wolf?.getFirstInstance();
        if (!wolf) return;

        const skeletons = runtime.objects.Skeleton?.getAllInstances() || [];
        skeletons.forEach(skeleton => processSkeleton(skeleton, wolf, CONFIG.skeleton, enemyState));

        const Eyeball = runtime.objects.Eyeball?.getAllInstances() || [];
        Eyeball.forEach(eye => processEvilEye(eye, wolf, CONFIG.evilEye, enemyState));
    });
});

function processSkeleton(skeleton, wolf, config, enemyState) {
    if (!enemyState.has(skeleton)) {
        enemyState.set(skeleton, {
            mode: 'idle',
            direction: 0,
            lastAttack: 0,
            health: config.health,
            spawnX: skeleton.x,
            deathTimer: 0
        });
    }
    
    const state = enemyState.get(skeleton);
    const now = Date.now();
    
    if (state.health <= 0) {
        state.mode = 'dead';
        skeleton.instVars.State = 'dead';
        
        state.deathTimer++;
        if (state.deathTimer > config.deathAnimationTime) {
            skeleton.destroy();
            enemyState.delete(skeleton);
        }
        return;
    }

    const distX = Math.abs(skeleton.x - wolf.x);
    const distY = Math.abs(skeleton.y - wolf.y);
    const canSeeWolf = distX < config.detectionRange && distY < 150;

    if (state.mode === 'attack' && distX > config.attackRange + 20) {
        state.mode = canSeeWolf ? 'chase' : 'idle';
        skeleton.instVars.State = state.mode === 'chase' ? 'walk' : 'idle';
        if (state.mode === 'idle') skeleton.dx = 0;
    }

    if (distX < config.attackRange && distY < 80 && state.mode !== 'dead') {
        state.mode = 'attack';
        skeleton.instVars.State = 'attack';
        
        const totalFrames = 8;
        
        if (skeleton.animationFrame === totalFrames - 1 && now - state.lastAttack > config.attackCooldown) {
            state.lastAttack = now;
            wolf.instVars.Life -= 1;
            
            if (wolf.instVars.Life <= 0) {
                wolf.destroy();
            }
        }
        return;
    }
    
    if (canSeeWolf && state.mode !== 'dead' && state.mode !== 'attack') {
        state.mode = 'chase';
        skeleton.instVars.State = 'walk';
        
        if (skeleton.x < wolf.x) {
            skeleton.x += config.chaseSpeed;
            state.direction = 1;
        } else {
            skeleton.x -= config.chaseSpeed;
            state.direction = -1;
        }
        return;
    }
    
    if (!canSeeWolf && state.mode !== 'dead' && state.mode !== 'attack') {
        if (distX > config.detectionRange + 50) {
            if (state.mode !== 'idle') {
                state.mode = 'idle';
                skeleton.instVars.State = 'idle';
                skeleton.dx = 0;
            }
            return;
        }
        
        if (state.mode !== 'patrol') {
            state.mode = 'patrol';
            skeleton.instVars.State = 'walk';
        }
        
        skeleton.x += config.patrolSpeed * state.direction;
        
        if (skeleton.x > state.spawnX + config.patrolWidth) {
            state.direction = -1;
        } else if (skeleton.x < state.spawnX - config.patrolWidth) {
            state.direction = 1;
        }
    }
}

function processEvilEye(eye, wolf, config, enemyState) {
    if (!enemyState.has(eye)) {
        enemyState.set(eye, {
            floatOffset: Math.random() * 100,
            health: config.health,
            spawnX: eye.x,
            spawnY: eye.y,
            lastDamage: 0
        });
    }
    
    const data = enemyState.get(eye);
    
    data.floatOffset += config.floatSpeed;
    eye.y = data.spawnY + Math.sin(data.floatOffset) * config.floatAmplitude;
    
    const distToWolf = Math.abs(eye.x - wolf.x);
    
    if (distToWolf < config.detectionRange) {
        if (eye.x < wolf.x) {
            eye.x += config.chaseSpeed;
        } else {
            eye.x -= config.chaseSpeed;
        }
    } else {
        if (Math.abs(eye.x - data.spawnX) > 5) {
            if (eye.x < data.spawnX) eye.x += config.chaseSpeed;
            else eye.x -= config.chaseSpeed;
        }
    }

    const now = Date.now();
    if (eye.testOverlap(wolf) && now - data.lastDamage > 1000) {
        data.lastDamage = now;
        wolf.instVars.Life -= 1;
        
        if (wolf.instVars.Life <= 0) {
            wolf.destroy();
        }
        
        const direction = eye.x < wolf.x ? -1 : 1;
        wolf.x += direction * 20;
        wolf.dy = -300;
    }
}