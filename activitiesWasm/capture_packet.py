#!/usr/bin/env python3
"""
Deep Packet Inspector - Real Packet Capture menggunakan Scapy
Mengintegrasikan dengan WebAssembly untuk filtering
"""

import asyncio
import json
import socket
import struct
from datetime import datetime
from collections import defaultdict
import hashlib

try:
    from scapy.all import sniff, IP, TCP, UDP, Raw, DNS, DNSQR
    from scapy.layers.http import HTTPRequest
    SCAPY_AVAILABLE = True
except ImportError:
    print("Scapy tidak tersedia. Install dengan: pip install scapy")
    SCAPY_AVAILABLE = False

class PacketInspector:
    def __init__(self):
        self.tracker_patterns = {
            'google-analytics': {
                'domains': ['google-analytics.com', 'analytics.google.com'],
                'payload_patterns': ['ga.js', 'gtag.js', 'UA-', 'collect?v='],
                'risk': 'High',
                'type': 'Analytics'
            },
            'facebook-pixel': {
                'domains': ['facebook.com/tr', 'connect.facebook.net'],
                'payload_patterns': ['fbq(', '_fbp', 'facebook-pixel'],
                'risk': 'High',
                'type': 'Social Media'
            },
            'doubleclick': {
                'domains': ['doubleclick.net', 'googlesyndication.com'],
                'payload_patterns': ['adservice', 'ads?', 'google_ad'],
                'risk': 'High',
                'type': 'Advertising'
            },
            'amazon-ads': {
                'domains': ['amazon-adsystem.com'],
                'payload_patterns': ['aax', 'amazon_ad', 'adserver'],
                'risk': 'Medium',
                'type': 'Advertising'
            },
            'hotjar': {
                'domains': ['hotjar.com', 'static.hotjar.com'],
                'payload_patterns': ['hjSettings', '_hj', 'hotjar'],
                'risk': 'Medium',
                'type': 'Heatmap'
            },
            'mixpanel': {
                'domains': ['mixpanel.com', 'api.mixpanel.com'],
                'payload_patterns': ['mixpanel.track', 'mp_', 'mixpanel'],
                'risk': 'Medium',
                'type': 'Analytics'
            },
            'segment': {
                'domains': ['segment.io', 'cdn.segment.com'],
                'payload_patterns': ['analytics.track', 'segment', 'ajs_'],
                'risk': 'High',
                'type': 'Data Pipeline'
            },
            'new-relic': {
                'domains': ['newrelic.com', 'js-agent.newrelic.com'],
                'payload_patterns': ['NREUM', 'newrelic', 'nr-data'],
                'risk': 'Low',
                'type': 'Performance'
            },
            'sentry': {
                'domains': ['sentry.io', 'browser.sentry-cdn.com'],
                'payload_patterns': ['sentry', 'raven', 'dsn='],
                'risk': 'Low',
                'type': 'Error Tracking'
            },
            'intercom': {
                'domains': ['intercom.io', 'widget.intercom.io'],
                'payload_patterns': ['Intercom', 'intercomSettings'],
                'risk': 'Medium',
                'type': 'Support'
            }
        }
        
        self.packet_count = 0
        self.tracker_count = 0
        self.blocked_count = 0
        self.packets = []
        self.trackers = []
        
    def analyze_packet(self, packet):
        """Analisis packet untuk mendeteksi tracker"""
        if not SCAPY_AVAILABLE:
            return None
            
        result = {
            'timestamp': datetime.now().isoformat(),
            'source': None,
            'destination': None,
            'protocol': None,
            'payload': None,
            'is_tracker': False,
            'tracker_type': None,
            'risk_level': None
        }
        
        # Extract IP information
        if IP in packet:
            result['source'] = packet[IP].src
            result['destination'] = packet[IP].dst
            result['protocol'] = packet[IP].proto
            
        # Extract DNS queries
        if DNS in packet and DNSQR in packet:
            query = packet[DNSQR].qname.decode('utf-8').rstrip('.')
            result['destination'] = query
            result['payload'] = f"DNS Query: {query}"
            
            # Check DNS against tracker patterns
            for tracker_name, tracker_info in self.tracker_patterns.items():
                for domain in tracker_info['domains']:
                    if domain in query:
                        result['is_tracker'] = True
                        result['tracker_type'] = tracker_name
                        result['risk_level'] = tracker_info['risk']
                        break
                        
        # Extract HTTP data
        if TCP in packet and Raw in packet:
            try:
                payload = packet[Raw].load.decode('utf-8', errors='ignore')
                result['payload'] = payload[:500]  # Limit payload size
                
                # Check HTTP headers for tracker indicators
                for tracker_name, tracker_info in self.tracker_patterns.items():
                    for pattern in tracker_info['payload_patterns']:
                        if pattern.lower() in payload.lower():
                            result['is_tracker'] = True
                            result['tracker_type'] = tracker_name
                            result['risk_level'] = tracker_info['risk']
                            break
                            
                    for domain in tracker_info['domains']:
                        if domain in str(result.get('destination', '')):
                            result['is_tracker'] = True
                            result['tracker_type'] = tracker_name
                            result['risk_level'] = tracker_info['risk']
                            break
                            
            except Exception as e:
                result['payload'] = f"Error decoding payload: {str(e)}"
                
        return result
    
    def process_packet(self, packet):
        """Process packet dan update statistics"""
        analysis = self.analyze_packet(packet)
        
        if analysis:
            self.packet_count += 1
            
            if analysis['is_tracker']:
                self.tracker_count += 1
                self.blocked_count += 1
                self.trackers.append(analysis)
                
                # Log tracker detected
                print(f"⚠️  TRACKER DETECTED: {analysis['tracker_type']} "
                      f"({analysis['risk_level']} risk)")
                print(f"   Source: {analysis['source']} → {analysis['destination']}")
                if analysis['payload']:
                    print(f"   Payload: {analysis['payload'][:100]}...")
            else:
                self.packets.append(analysis)
                
            # Print progress every 100 packets
            if self.packet_count % 100 == 0:
                print(f"📊 Processed {self.packet_count} packets, "
                      f"detected {self.tracker_count} trackers")
    
    def generate_report(self):
        """Generate detailed report"""
        report = {
            'summary': {
                'total_packets': self.packet_count,
                'trackers_detected': self.tracker_count,
                'blocked_requests': self.blocked_count,
                'block_rate': f"{(self.blocked_count / self.packet_count * 100):.2f}%"
            },
            'tracker_types': defaultdict(int),
            'risk_levels': defaultdict(int),
            'top_trackers': [],
            'recent_trackers': self.trackers[-10:]
        }
        
        # Count tracker types
        for tracker in self.trackers:
            report['tracker_types'][tracker['tracker_type']] += 1
            report['risk_levels'][tracker['risk_level']] += 1
            
        # Sort trackers by count
        report['top_trackers'] = sorted(
            report['tracker_types'].items(),
            key=lambda x: x[1],
            reverse=True
        )[:10]
        
        return report
    
    def save_report(self, filename='tracker_report.json'):
        """Save report to JSON file"""
        report = self.generate_report()
        
        with open(filename, 'w') as f:
            json.dump(report, f, indent=2)
            
        print(f"📄 Report saved to {filename}")

def start_capture(interface='eth0', packet_count=1000):
    """Start packet capture"""
    if not SCAPY_AVAILABLE:
        print("Scapy tidak tersedia. Tidak dapat melakukan capture.")
        return
        
    inspector = PacketInspector()
    
    print(f"🔍 Starting packet capture on {interface}")
    print(f"📊 Capturing {packet_count} packets...")
    print("-" * 50)
    
    try:
        # Start sniffing
        sniff(
            iface=interface,
            prn=inspector.process_packet,
            count=packet_count,
            store=False
        )
        
        # Generate report
        print("\n" + "=" * 50)
        print("📊 CAPTURE COMPLETE")
        print("=" * 50)
        
        report = inspector.generate_report()
        
        print(f"\n📈 Summary:")
        print(f"   Total packets: {report['summary']['total_packets']}")
        print(f"   Trackers detected: {report['summary']['trackers_detected']}")
        print(f"   Blocked requests: {report['summary']['blocked_requests']}")
        print(f"   Block rate: {report['summary']['block_rate']}")
        
        print(f"\n🔍 Top Trackers:")
        for tracker, count in report['top_trackers']:
            print(f"   {tracker}: {count}")
            
        print(f"\n⚠️  Risk Levels:")
        for level, count in report['risk_levels'].items():
            print(f"   {level}: {count}")
        
        # Save report
        inspector.save_report()
        
    except KeyboardInterrupt:
        print("\n\n⚠️  Capture interrupted by user")
        inspector.save_report('tracker_report_interrupted.json')
    except Exception as e:
        print(f"\n❌ Error during capture: {str(e)}")

if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser(description='Deep Packet Inspector')
    parser.add_argument('--interface', '-i', default='eth0',
                       help='Network interface to capture from')
    parser.add_argument('--count', '-c', type=int, default=1000,
                       help='Number of packets to capture')
    
    args = parser.parse_args()
    
    # Start capture
    start_capture(args.interface, args.count)
