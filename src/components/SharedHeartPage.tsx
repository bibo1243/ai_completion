import React from 'react';
import { HeartScheduleView } from './HeartScheduleView';

export const SharedHeartPage = () => {
    return (
        <div className="w-full h-screen bg-gray-100 flex items-center justify-center">
            <div className="w-full h-full md:max-w-[430px] md:h-[90vh] md:rounded-[3rem] md:border-8 md:border-gray-900 bg-white relative shadow-2xl overflow-hidden">
                {/* Mobile Frame Simulation on Desktop */}
                <HeartScheduleView isStandalone={true} />
            </div>
        </div>
    );
};
