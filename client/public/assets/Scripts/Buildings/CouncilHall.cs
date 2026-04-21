using UnityEngine;
using LostCity.Core;

namespace LostCity.Buildings
{
    public class CouncilHall : BuildingBase
    {
        protected override void OnDestroyed()
        {
            EventBus.Publish(new CouncilHallDestroyedEvent());
            base.OnDestroyed();
        }
    }
}
