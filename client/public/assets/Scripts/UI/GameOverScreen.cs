using UnityEngine;
using UnityEngine.SceneManagement;
using TMPro;
using LostCity.Core;

namespace LostCity.UI
{
    public class GameOverScreen : MonoBehaviour
    {
        [SerializeField] private GameObject _victoryPanel;
        [SerializeField] private GameObject _defeatPanel;
        [SerializeField] private TextMeshProUGUI _defeatReasonText;

        private void Start()
        {
            _victoryPanel.SetActive(false);
            _defeatPanel.SetActive(false);

            GameManager.Instance.OnGameStateChanged += OnStateChanged;
            GameManager.Instance.OnDefeat += OnDefeat;
        }

        private void OnDestroy()
        {
            if (GameManager.Instance == null) return;
            GameManager.Instance.OnGameStateChanged -= OnStateChanged;
            GameManager.Instance.OnDefeat -= OnDefeat;
        }

        private void OnStateChanged(GameState state)
        {
            if (state == GameState.Victory)
                _victoryPanel.SetActive(true);
        }

        private void OnDefeat(DefeatReason reason)
        {
            _defeatPanel.SetActive(true);
            if (_defeatReasonText != null)
            {
                _defeatReasonText.text = reason == DefeatReason.SophieCaptured
                    ? "소피가 네버세인에게 납치되었습니다!"
                    : "의회 홀이 파괴되었습니다!";
            }
        }

        public void Restart() => SceneManager.LoadScene(SceneManager.GetActiveScene().buildIndex);
        public void MainMenu() => SceneManager.LoadScene(0);
    }
}
