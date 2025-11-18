import { useEffect, useState, useRef } from 'react';
import { 
  isMinVersionSupported, 
  openGameCenterLeaderboard, 
  submitGameCenterLeaderBoardScore,
  getUserKeyForGame,
  GoogleAdMob,
  Storage
} from '@apps-in-toss/web-framework';

const UNITY_BUILD_PATH = '/unity/Build';
const GAME_NAME = '빌드 했을때 이름'; // 빌드 했을때 빌드본 이름
const LOADING_CONTENT = '로딩로딩'; // 맨앞에 로딩창에 쓰일 문구 ( 게임이름추천 )
const UNITY_SETTINGS = {
  companyName: '', // 회사명
  productName: '', // 게임이름
  productVersion: '1.0.0',
};


// 전역 선언
declare global {
  interface Window {
    createUnityInstance: any;
    TossGetUserKeyForGame?: () => Promise<any>;
    TossOpenGameCenterLeaderboard?: () => boolean;
    TossSubmitGameCenterLeaderBoardScore?: (score: string) => Promise<any>;
    TossStorageGetItem?: (key: string) =>  Promise<string | null>;
    TossStorageSetItem?: (key:string,value:string) => Promise<void>;
    TossStorageRemoveItem?: (key:string) => Promise<void>;
    TossStorageAllClearItem?: () => Promise<void>;
    TossLoadAD?: (adGroupID:string, callback: (event: any) => void) => void;
    TossShowAD?: (adGroupID:string, callback: (event: any) => void) => void;
  }
}

// 콜백 전역 선언
let currentLoadAdCallback: ((event: any) => void) | null = null;
let currentShowAdCallback: ((event: any) => void) | null = null;
// loadAd 리스너 해제용 cleanup 함수
let loadAdCleanup: (() => void) | null = null;

const UnityCanvas = () => {

  const isMounted = useRef(false);
  // 로딩 진행 상태
  const [loadingProgress, setLoadingProgress] = useState(0);

  useEffect(() => {
    // 로그인 혹은 키값 얻기
    window.TossGetUserKeyForGame = async () => {
      try {
        const result = await getUserKeyForGame();
        return result;
      } catch (error) {
        console.error('로그인 혹은 키값 얻기중 에러 발생 : ', error);
        throw error;
      }
    };

    // 리더보드 열기
    window.TossOpenGameCenterLeaderboard = () => {
      try {
        const isSupported = isMinVersionSupported({
          android: "5.221.0",
          ios: "5.221.0",
        });
        if (!isSupported) {
          console.warn('지원하지 않는 앱 버전입니다.');
          return false;
        }
        openGameCenterLeaderboard();
        return true;
      } catch (error) {
        console.error('리더보드 여는중 에러 발생 : ', error);
        throw error;
      }
    };

    // 리더보드에 점수 보내기
    window.TossSubmitGameCenterLeaderBoardScore = async (score:string) => {
      try {
        const result = await submitGameCenterLeaderBoardScore({ score: score });
        return result;
      } catch (error) {
        console.error('점수 제출 중 오류 발생 : ', error);
        throw error;
      }
    }

      // 키에 값 얻어오기
    window.TossStorageGetItem = async (key:string) => {
      try {
        const storageValue = await Storage.getItem(key);
        return storageValue;
      } catch (error) {
        console.error('키에 값 얻어오기 중 오류 발생 : ', error);
        throw error;
      }
    }
    // 키에 정보 저장
    window.TossStorageSetItem = async (key:string,value:string) => {
      try {
        const result = await Storage.setItem(key, value);
        return result;
      } catch (error) {
        console.error('키에 정보 저장 중 오류 발생 : ', error);
        throw error;
      }
    }
      // 키값 정보 삭제
    window.TossStorageRemoveItem = async (key:string) => {
      try {
        const result = await Storage.removeItem(key);
        return result;
      } catch (error) {
        console.error('키값 정보 삭제 중 오류 발생 : ', error);
        throw error;
      }
    }

    // 모든 저장 정보 삭제
    window.TossStorageAllClearItem = async () => {
      try {
        const result = await Storage.clearItems();
        return result;
      } catch (error) {
        console.error('모든 저장 정보 삭제 중 오류 발생 : ', error);
        throw error;
      }
    }


    // 인앱 광고 로드
    window.TossLoadAD = (adGroupID: string, callback: (event: any) => void) => {
      // 콜백 등록
      currentLoadAdCallback = callback;

      // 이전에 등록된 리스너 있으면 정리
      if (loadAdCleanup) {
        try {
          loadAdCleanup();
        } catch (e) {
          console.warn('이전 loadAd cleanup 중 오류:', e);
        }
        loadAdCleanup = null;
      }
      
      if (GoogleAdMob.loadAppsInTossAdMob.isSupported() !== true) {
        // 현재 실행 중인 앱(예: 토스 앱, 개발용 샌드박스 앱 등)에서 Google AdMob 광고 기능을 지원하는지 확인
        callback({ type: 'error', message: 'AdMob Not Supported' });
        return;
      }
      
      loadAdCleanup = GoogleAdMob.loadAppsInTossAdMob({
        options: { adGroupId: adGroupID },
        onEvent: (event) => {
          console.log(event.type);
          if (currentLoadAdCallback) {
            // 성공
            currentLoadAdCallback(event);
          }
        },
        onError: (error) => {
          if (currentLoadAdCallback) {
            // 실패
            currentLoadAdCallback({ type: 'error', message: error.toString() });
          }
        },
      });
    };

    // 인앱 광고 표기
    window.TossShowAD = (adGroupID: string, callback: (event: any) => void) => {
      // 콜백 등록
      currentShowAdCallback = callback;
      
      if (GoogleAdMob.showAppsInTossAdMob.isSupported() !== true) {
        // 현재 실행 중인 앱(예: 토스 앱, 개발용 샌드박스 앱 등)에서 Google AdMob 광고 기능을 지원하는지 확인
        callback({ type: 'error', message: 'AdMob Not Supported' });
        return;
      }
      
      GoogleAdMob.showAppsInTossAdMob({
        options: { adGroupId: adGroupID },
        onEvent: (event) => {
          if (currentShowAdCallback) {
            currentShowAdCallback(event);
          }
        },
        onError: (error) => {
          if (currentShowAdCallback) {
            // 실패
            currentShowAdCallback({ type: 'error', message: error.toString() });
          }
        },
      });
    };


    // 중복 마운트 방지
    // Unity 인스턴스는 한 번만 실행
    if (!isMounted.current) {

      isMounted.current = true;
      // Unity 로더 스크립트 로드 후 createUnityInstance 실행
      const script = document.createElement('script');
      script.src = `${UNITY_BUILD_PATH}/${GAME_NAME}.loader.js`;
      script.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.id = 'unity-canvas';
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        const container = document.getElementById('unity-container');
        if (!container) return;
        container.appendChild(canvas);

        const unityConfig = {
          dataUrl: `${UNITY_BUILD_PATH}/${GAME_NAME}.data`,
          frameworkUrl: `${UNITY_BUILD_PATH}/${GAME_NAME}.framework.js`,
          codeUrl: `${UNITY_BUILD_PATH}/${GAME_NAME}.wasm`,
          streamingAssetsUrl: '/unity/StreamingAssets',
          ...UNITY_SETTINGS,
        };

        window
          .createUnityInstance(
            canvas,
            unityConfig,
            (progress: number) => {
              // progress: 0 ~ 1
              setLoadingProgress(progress);
            }
          )
          .then(() => {
            console.log('Unity 인스턴스 생성 완료');
            setLoadingProgress(1); // 100%로 마무리
          })
          .catch((err: any) => {
            console.error('Unity 인스턴스 생성 실패:', err);
          });
      };
      document.body.appendChild(script);

      return () => {
        // 이전에 등록된 리스너 있으면 정리
        if (loadAdCleanup) {
          try {
            loadAdCleanup();
          } catch (e) {
            console.warn('이전 loadAd cleanup 중 오류:', e);
          }
          loadAdCleanup = null;
        }

        // 전역 Toss 함수 초기화
        delete window.TossOpenGameCenterLeaderboard;
        delete window.TossSubmitGameCenterLeaderBoardScore;
        delete window.TossStorageGetItem;
        delete window.TossStorageSetItem;
        delete window.TossStorageRemoveItem;
        delete window.TossStorageAllClearItem;
        delete window.TossLoadAD;
        delete window.TossShowAD;

        window.TossGetUserKeyForGame = undefined;
        document.body.removeChild(script);
      };
    }
  }, []);

  return (
      <div
      style={{
        position: 'relative',
        width: '100vw',
        height: '100vh',
        background: '#000',
      }}
    >
      <div
        id="unity-container"
        style={{ width: '100%', height: '100%' }}
      />

      {loadingProgress < 1 && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center',
            color: '#fff',
            fontFamily: 'Arial',
          }}
        >
          <img
            src="https://pbs.twimg.com/profile_images/1566569005619355649/VzgTcumJ_400x400.png"
            alt="game-logo"
            style={{ width: 120, height: 120, marginBottom: 10, borderRadius: 12 }}
          />

          <div style={{ fontSize: 22, marginBottom: 20, fontWeight: 900}}>
            {LOADING_CONTENT}
          </div>

          <div
            style={{
              width: 200,
              height: 12,
              background: '#454545ff',
              borderRadius: 3,
              overflow: 'hidden',
              margin: '0 auto',
            }}
          >
            <div
              style={{
                width: `${loadingProgress * 100}%`,
                height: '100%',
                background: '#ffffffff',
                transition: 'width 0.1s linear',
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default UnityCanvas;