using UnityEngine;
using LostCity.Core;

namespace LostCity.Units
{
    public class KeefeSencen : UnitBase
    {
        [SerializeField] private Abilities.EmotionSurgeAbility _emotionSurge;

        public Abilities.EmotionSurgeAbility EmotionSurge => _emotionSurge;

        protected override void Awake()
        {
            base.Awake();
            if (_emotionSurge == null)
                _emotionSurge = GetComponentInChildren<Abilities.EmotionSurgeAbility>();
        }

        public override void OrderAttack(IDamageable target)
        {
            var targetMono = target as MonoBehaviour;
            if (targetMono == null) return;

            float dist = Vector3.Distance(transform.position, targetMono.transform.position);
            if (_emotionSurge != null && _emotionSurge.IsReady && dist <= (_data != null ? _data.AttackRange * 2f : 8f))
            {
                _emotionSurge.TryActivate(targetMono.transform.position);
            }
            else
            {
                base.OrderAttack(target);
            }
        }

        public bool UseEmotionSurge(Vector3 center)
        {
            if (_emotionSurge == null) return false;
            return _emotionSurge.TryActivate(center);
        }
    }
}
