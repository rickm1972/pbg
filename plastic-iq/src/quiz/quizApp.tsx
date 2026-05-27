import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { QuizLandingPage } from './screens/QuizLandingPage'
import { QuizQuestionScreen } from './screens/QuizQuestionScreen'
import { QuizInterstitialScreen } from './screens/QuizInterstitialScreen'
import { QuizEmailCaptureScreen } from './screens/QuizEmailCaptureScreen'
import { QuizLoadingScreen } from './screens/QuizLoadingScreen'
import { QuizResultsScreen } from './screens/QuizResultsScreen'
import { QuizMotivationScreen } from './screens/QuizMotivationScreen'
import { QuizTakeawayScreen } from './screens/QuizTakeawayScreen'
import { QuizClosingScreen } from './screens/QuizClosingScreen'

export function QuizApp() {
  return (
    <BrowserRouter>
      <Routes>
        <Route index element={<QuizLandingPage />} />
        <Route path="/q/:qId" element={<QuizQuestionScreen />} />
        <Route path="/i/:which" element={<QuizInterstitialScreen />} />
        <Route path="/email" element={<QuizEmailCaptureScreen />} />
        <Route path="/loading" element={<QuizLoadingScreen />} />
        <Route path="/result" element={<QuizResultsScreen />} />
        <Route path="/motivation" element={<QuizMotivationScreen />} />
        <Route path="/takeaway" element={<QuizTakeawayScreen />} />
        <Route path="/closing" element={<QuizClosingScreen />} />
        <Route path="/learn" element={<Navigate to="/takeaway" replace />} />
        <Route path="/thanks" element={<Navigate to="/closing" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
