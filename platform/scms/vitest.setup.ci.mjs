import { spawn, execSync } from 'child_process';

function startSomeProcess(command, args) {
  // Start a server process
  const server = spawn(command, args, {
    stdio: ['ignore', 'pipe', 'pipe'], // Allow capturing stdout/stderr
  });

  // Listen for data from the stdout of the server process
  server.stdout?.on('data', (data) => {
    const output = data.toString();
    // Only log important messages to avoid noise
    if (output.includes('ready') || output.includes('error') || output.includes('Error')) {
      console.log(`[server] ${output.trim()}`);
    }
  });

  // Listen for any errors
  server.stderr?.on('data', (data) => {
    const output = data.toString();
    // Log all stderr as it's usually important
    console.error(`[server stderr] ${output.trim()}`);
  });

  // Handle server process exit
  server.on('close', (code) => {
    console.log(`[server] process exited with code ${code}`);
  });

  // Handle other potential errors
  server.on('error', (error) => {
    console.error(`[server] Failed to start subprocess: ${error.message}`);
  });

  return server;
}

function stopServer(server, callback) {
  if (server && !server.killed) {
    server.kill();
    callback(null, 'Server stopped');
  } else {
    callback(new Error('Server not running or already stopped'));
  }
}

export default async function () {
  execSync('npm run test:db:reset', { stdio: 'inherit' });

  console.log('Starting test server...');
  const server = startSomeProcess('npm', ['run', 'test:start-server']);
  
  // Give the process a moment to start or fail
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Check if the process is still running
  if (server.killed || server.exitCode !== null) {
    throw new Error('Server process failed to start or exited immediately');
  }

  process.on('exit', function () {
    setTimeout(() => {
      try {
        const lsof = execSync(`lsof -i :3032`).toString();
        if (!lsof) return console.log('no server running on 3032');
        const [cmd, pid, ..._] = lsof.split('\n')[1].split(/\s+/);
        console.log(`killing server... ${pid}`);
        execSync(`kill -9 ${pid}`);
      } catch (error) {
        console.log('Server already stopped.');
      }
    }, 500);
  });

  let ready = false;
  let tries = 0;
  const maxTries = 60;
  
  // Helper function to delay
  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  
  while (!ready && tries < maxTries) {
    await delay(2000); // Wait 2 seconds

    try {
      const res = await fetch('http://localhost:3032');
      if (res.status === 200) {
        ready = true;
        console.log('Server ready!!!');
      } else {
        tries++;
        console.log(`Waiting for server to start... (attempt ${tries}/${maxTries}, status: ${res.status})`);
      }
    } catch (error) {
      tries++;
      console.log(`Waiting for server to start... (attempt ${tries}/${maxTries})`);
    }
  }
  
  if (!ready) {
    throw new Error(`Server failed to start after ${maxTries} attempts (${maxTries * 2} seconds)`);
  }

  return () =>
    stopServer(server, (err, msg) => {
      if (err) console.error(err, msg);
      else console.log(msg);
      process.exit(0);
    });
}
