import axios from 'axios';

const BACKEND_URL = 'http://localhost:4000/api';

export const getStatus = async () => {
    try {
        const { data } = await axios.get(`${BACKEND_URL}/status`);
        return data;
    } catch (error) {
        return null;
    }
};

export const getInsights = async () => {
    try {
        const { data } = await axios.get(`${BACKEND_URL}/insights`);
        return data.insights || [];
    } catch (error) {
        return [];
    }
};

export const triggerAction = async (service, action) => {
    try {
        // action should be 'restart', 'heal', 'down', 'slow'
        // Map 'down'/'slow' to simulate endpoints if needed, or use the backend action endpoint
        const { data } = await axios.post(`${BACKEND_URL}/action/${service}/${action}`);
        return data;
    } catch (error) {
        throw new Error(error.response?.data?.error || error.message);
    }
};
