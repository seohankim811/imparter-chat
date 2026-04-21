using UnityEngine;
using LostCity.Core;

namespace LostCity.Buildings
{
    public class NeverseenBase : BuildingBase
    {
        [SerializeField] private Transform[] _spawnPoints;

        public Transform[] SpawnPoints => _spawnPoints;

        public Transform GetSpawnPoint()
        {
            if (_spawnPoints == null || _spawnPoints.Length == 0)
                return transform;
            return _spawnPoints[Random.Range(0, _spawnPoints.Length)];
        }

        protected override void OnDestroyed()
        {
            EventBus.Publish(new NeverseenBaseDestroyedEvent());
            base.OnDestroyed();
        }
    }
}
