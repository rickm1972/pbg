import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { QuizLandingPage } from './screens/QuizLandingPage'
import { QuizQuestionScreen } from './screens/QuizQuestionScreen'
import { QuizInterstitialScreen } from './screens/QuizInterstitialScreen'
import { QuizEmailCaptureScreen } from './screens/QuizEmailCaptureScreen'
import { QuizLoadingScreen } from './screens/QuizLoadingScreen'
import { QuizResultsScreen } from './screens/QuizResultsScreen'
import { QuizMotivationScreen } from './screens/QuizMotivationScreen'
import { QuizThankYouScreen } from './screens/QuizThankYouScreen'

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
        <Route path="/thanks" element={<QuizThankYouScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

