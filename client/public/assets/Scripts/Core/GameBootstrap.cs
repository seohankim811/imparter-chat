// 런타임 시 게임 초기 상태를 설정하는 부트스트랩 컴포넌트
// 씬의 GameManager 오브젝트에 추가하면 자동으로 소피 유닛을 찾아 등록합니다.
using UnityEngine;

namespace LostCity.Core
{
    public class GameBootstrap : MonoBehaviour
    {
        [SerializeField] private Units.SophieFoster _sophie;
        [SerializeField] private Buildings.CouncilHall _councilHall;
        [SerializeField] private Buildings.NeverseenBase _neverseenBase;

        private void Awake()
        {
            // Auto-find if not assigned
            if (_sophie == null)
                _sophie = FindFirstObjectByType<Units.SophieFoster>();
            if (_councilHall == null)
                _councilHall = FindFirstObjectByType<Buildings.CouncilHall>();
            if (_neverseenBase == null)
                _neverseenBase = FindFirstObjectByType<Buildings.NeverseenBase>();

            if (_sophie == null)
                Debug.LogWarning("[Bootstrap] 소피 포스터 유닛을 찾을 수 없습니다. 씬에 배치하세요.");
            if (_councilHall == null)
                Debug.LogWarning("[Bootstrap] 의회 홀을 찾을 수 없습니다. 씬에 배치하세요.");
            if (_neverseenBase == null)
                Debug.LogWarning("[Bootstrap] 네버세인 기지를 찾을 수 없습니다. 씬에 배치하세요.");
        }

        private void Start()
        {
            // 소피를 초기 위치(의회 홀 근처)에 배치
            if (_sophie != null && _councilHall != null)
            {
                Vector3 startPos = _councilHall.transform.position + new Vector3(0, 0, 5);
                _sophie.transform.position = startPos;
            }

            Debug.Log("[Bootstrap] 게임 초기화 완료. 잃어버린 도시의 수호자 시작!");
        }
    }
}
