#!/bin/bash
echo "Setting up Attendance System..."

echo "1. Installing backend dependencies..."
cd /root/attendance-app/backend
npm install

echo "2. Starting backend server..."
nohup node index.js > backend.log 2>&1 &
echo "Backend started on port 3001"

echo "3. Creating admin user..."
sleep 2
curl -s -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Admin","email":"admin@company.com","password":"admin123","role":"admin"}' > /dev/null

echo "4. Installing frontend dependencies..."
cd /root/attendance-app/frontend
npm install

echo "5. Starting frontend..."
nohup npm start > frontend.log 2>&1 &
sleep 5

echo ""
echo "Setup complete!"
echo "Backend: http://localhost:3001"
echo "Frontend: http://localhost:3000"
echo "Admin credentials: admin@company.com / admin123"
echo ""
echo "Logs: backend/backend.log frontend/frontend.log"
