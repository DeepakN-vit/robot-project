import socketio
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from geopy.geocoders import Nominatim
import json
from datetime import datetime
import asyncio
import os

# Create FastAPI instance
app = FastAPI()

# Add CORS middleware for React front-end
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Allow React app's origin
    allow_credentials=True,
    allow_methods=["*"],  # Allow all HTTP methods
    allow_headers=["*"],  # Allow all headers
)

# Initialize Socket.IO server
sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins=["http://localhost:3000"])
socket_app = socketio.ASGIApp(sio)

# Path for robot data
file_path = os.path.join(os.path.dirname(__file__), "json", "fake_robot_data.json")

# Load robot data from JSON file
def load_robot_data():
    try:
        with open(file_path, "r") as file:
            return json.load(file)
    except FileNotFoundError:
        print(f"JSON file not found at {file_path}. Ensure 'fake_robot_data.json' exists.")
        return []
    except json.JSONDecodeError:
        print(f"Error decoding JSON file at {file_path}.")
        return []

robots = load_robot_data()

# Geolocator for converting lat/long to location names
geolocator = Nominatim(user_agent="robot-dashboard")

# Function to convert lat/lon to location name
def get_place_from_coordinates(lat, lon):
    try:
        location = geolocator.reverse((lat, lon), language="en", timeout=10)
        return location.address if location else "Unknown location"
    except Exception as e:
        print(f"Error in geocoding: {e}")
        return "Unknown location"

# REST API to get the list of robots
@app.get("/robots")
async def get_robots():
    """Fetch the list of robots with updated location names."""
    updated_robots = []
    for robot in robots:
        lat, lon = robot.get("Location Coordinates", [None, None])
        robot["Location Name"] = get_place_from_coordinates(lat, lon) if lat and lon else "Unknown location"
        updated_robots.append(robot)
    return JSONResponse(content={"robots": updated_robots})

# Background task to simulate real-time updates
async def simulate_real_time_updates():
    """Simulate real-time robot data updates."""
    while True:
        for robot in robots:
            lat, lon = robot.get("Location Coordinates", [None, None])
            robot["Location Name"] = get_place_from_coordinates(lat, lon) if lat and lon else "Unknown location"

            if robot.get("Online/Offline", False):  # Check if the robot is online
                # Update robot's state
                robot["Battery Percentage"] = max(0, robot.get("Battery Percentage", 0) - 1)
                robot["CPU Usage"] = min(100, robot.get("CPU Usage", 0) + 1)
                robot["Last Updated"] = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")

                # If battery is drained, set the robot offline
                if robot["Battery Percentage"] <= 0:
                    robot["Online/Offline"] = False
        await sio.emit("update", {"robots": robots})  # Send updated data to connected clients
        await asyncio.sleep(5)

@app.on_event("startup")
async def startup():
    """Start the background task during application startup."""
    asyncio.create_task(simulate_real_time_updates())

# Handle Socket.IO client connection
@sio.event
async def connect(sid, environ):
    print(f"Client connected: {sid}")

# Handle Socket.IO client disconnection
@sio.event
async def disconnect(sid):
    print(f"Client disconnected: {sid}")

# Mount Socket.IO app
app.mount("/", socket_app)
