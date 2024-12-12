import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import "leaflet/dist/leaflet.css";
import "./robotDashboard.css";
import { FaFilter } from 'react-icons/fa'; // For filter icon

// WebSocket connection
const socket = io('http://127.0.0.1:8000/ws');

const RobotDashboard = () => {
  const [robots, setRobots] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [robotStats, setRobotStats] = useState({
    totalRobots: 0,
    totalOnline: 0,
    lowBattery: 0,
  });
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [filterVisible, setFilterVisible] = useState(false); // To control the filter dropdown visibility

  // Define fetchRobots with useCallback to memoize the function
  const fetchRobots = useCallback(async () => {
    try {
      const response = await axios.get('http://127.0.0.1:8000/robots');
      console.log('Fetched robots:', response.data); // Debugging
      setRobots(response.data.robots || []);
      calculateStats(response.data.robots || []);
    } catch (error) {
      console.error('Error fetching robots:', error);
    }
  }, []); // Empty dependency array to ensure fetchRobots function stays stable

  // Calculate statistics
  const calculateStats = (robotsData) => {
    const totalRobots = robotsData.length;
    const totalOnline = robotsData.filter((robot) => robot['Online/Offline']).length;
    const lowBattery = robotsData.filter((robot) => robot['Battery Percentage'] < 20).length;

    setRobotStats({
      totalRobots,
      totalOnline,
      lowBattery,
    });
  };

  // Handle search input
  const handleSearchChange = (event) => {
    setSearchQuery(event.target.value);
  };

  // Filter robots based on search query
  const filteredRobots = robots.filter((robot) =>
    robot['Robot ID'].toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Fetch initial data and listen for real-time updates
  useEffect(() => {
    fetchRobots();

    socket.on('message', (data) => {
      console.log('Received WebSocket data:', data); // Debugging
      setRobots(data.robots || []);
      calculateStats(data.robots || []);
    });

    return () => {
      socket.off('message');
    };
  }, [fetchRobots]); // Add fetchRobots as a dependency

  // Toggle location on button click
  const handleShowLocation = (location) => {
    if (
      selectedLocation && 
      selectedLocation[0] === location[0] && 
      selectedLocation[1] === location[1]
    ) {
      setSelectedLocation(null); // Remove location if it's already selected
    } else {
      setSelectedLocation(location); // Set new location
    }
  };

  // Toggle filter visibility
  const toggleFilter = () => {
    setFilterVisible(!filterVisible);
  };

  return (
    <div className="dashboard">
      <h1>Robot Fleet Dashboard</h1>

      <div className="search-bar">
        <input
          type="text"
          placeholder="Search by Robot ID"
          value={searchQuery}
          onChange={handleSearchChange}
        />
        <div className="filter-icon" onClick={toggleFilter}>
          <FaFilter />
        </div>
        {filterVisible && (
          <div className="filter-dropdown">
            <button onClick={() => setSearchQuery('Online')}>Online</button>
            <button onClick={() => setSearchQuery('Offline')}>Offline</button>
          </div>
        )}
      </div>

      <div className="stats">
        <p>Total Robots: {robotStats.totalRobots}</p>
        <p>Online Robots: {robotStats.totalOnline}</p>
        <p>Robots with Low Battery: {robotStats.lowBattery}</p>
      </div>

      <h2>Robot Details</h2>

      <table>
        <thead>
          <tr>
            <th>Robot ID</th>
            <th>Status</th>
            <th>Battery</th>
            <th>CPU Usage</th>
            <th>RAM Consumption</th>
            <th>Last Updated</th>
            <th>Location</th>
          </tr>
        </thead>
        <tbody>
          {filteredRobots.map((robot, index) => {
            const isLowBattery = robot['Battery Percentage'] <= 20;
            return (
              <tr key={index} className={isLowBattery ? 'low-battery' : ''}>
                <td>{robot['Robot ID']}</td>
                <td>{robot['Online/Offline'] ? 'Online' : 'Offline'}</td>
                <td>{robot['Battery Percentage']}%</td>
                <td>{robot['CPU Usage']}%</td>
                <td>{robot['RAM Consumption']} MB</td>
                <td>{robot['Last Updated']}</td>
                
                <td>
                  <button onClick={() => handleShowLocation(robot['Location Coordinates'])}>
                    {selectedLocation &&
                    selectedLocation[0] === robot['Location Coordinates'][0] &&
                    selectedLocation[1] === robot['Location Coordinates'][1]
                      ? 'Hide Location'
                      : 'Show Location'}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {selectedLocation && (
        <div className="map-container">
          <h3>Location Map</h3>
          <MapContainer
            center={selectedLocation}
            zoom={13}
            style={{ height: '400px', width: '100%' }}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="&copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors"
            />
            <Marker position={selectedLocation}>
              <Popup>
                Latitude: {selectedLocation[0]} <br /> Longitude: {selectedLocation[1]}
              </Popup>
            </Marker>
          </MapContainer>
        </div>
      )}
    </div>
  );
};

export default RobotDashboard;
